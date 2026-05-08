import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { Crux, SubClaim } from "@proofiness/shared-types";
import { getAnthropic, logAnthropicError } from "../lib/anthropic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "..", "prompts", "crux.md");

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  _systemPrompt = await readFile(PROMPT_PATH, "utf8");
  return _systemPrompt;
}

const CruxSchema = z.object({
  hingesOn: z.array(z.string()),
  summary: z.string().min(1),
});

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}

interface IdentifyCruxInput {
  claim: string;
  subClaims: SubClaim[];
}

export async function identifyCrux({ claim, subClaims }: IdentifyCruxInput): Promise<Crux | null> {
  if (subClaims.length === 0) return null;

  const validIds = new Set(subClaims.map((sc) => sc.id));
  const client = getAnthropic();
  const system = await loadSystemPrompt();
  const model = process.env.CRUX_MODEL ?? "claude-sonnet-4-6";

  // Compact view: the model needs structure (id, text, type, contestation, steelman shape)
  // but not full sources or full prose. Keep the prompt small.
  const compactSubClaims = subClaims.map((sc) => ({
    id: sc.id,
    text: sc.text,
    type: sc.type,
    contestation: sc.contestation?.label ?? null,
    contestationNote: sc.contestation?.note ?? null,
    steelman: sc.steelman
      ? {
          for: {
            argument: sc.steelman.for.argument,
            sourceCount: sc.steelman.for.sourceIds.length,
          },
          against: {
            argument: sc.steelman.against.argument,
            sourceCount: sc.steelman.against.sourceIds.length,
          },
        }
      : null,
  }));

  const userBody = JSON.stringify({ claim, subClaims: compactSubClaims }, null, 2);

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userBody }],
    });
  } catch (err) {
    logAnthropicError("crux", claim.slice(0, 80), err);
    return null;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  let raw: unknown;
  try {
    raw = extractJson(textBlock.text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[crux] invalid JSON: ${msg}`);
    return null;
  }

  const parsed = CruxSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[crux] schema validation failed: ${parsed.error.message}`);
    return null;
  }

  // Defense in depth #1: drop any hingesOn ids the model invented that aren't
  // real sub-claims.
  const hingesOn = parsed.data.hingesOn.filter((id) => validIds.has(id));

  // Defense in depth #2: verdict-shape guard. The crux summary is the highest-
  // visibility surface in the dossier and the most prone to verdict drift. If
  // it contains banned phrases, replace with a structural fallback rather than
  // ship a verdict-by-proxy at the top of the page.
  const summary = guardVerdictLanguage(parsed.data.summary, hingesOn.length);

  return { hingesOn, summary };
}

// Phrases that turn the structural summary into a verdict-by-proxy. These are
// drawn from crux.md's "BAD summaries" list. Match is case-insensitive and
// substring-based — broader than necessary, but the cost of a false positive
// (replacing a fine summary with the fallback) is much lower than the cost of
// a false negative (shipping a verdict at the top of the dossier).
const VERDICT_PHRASES = [
  /\bon balance\b/i,
  /\bweighs (in favor|against)\b/i,
  /\b(more|most) likely (true|false)\b/i,
  /\b(stronger|weaker) case\b/i,
  /\b(stronger|weaker) (side|argument)\b/i,
  /\bevidence (suggests|cuts|leans|favors|supports)\b/i,
  /\bleans (toward|against)\b/i,
  /\b(most|the) sources (support|cut against|favor)\b/i,
  /\bthe (claim|evidence) is (likely|probably) (true|false)\b/i,
];

function guardVerdictLanguage(summary: string, hingeCount: number): string {
  const matched = VERDICT_PHRASES.find((p) => p.test(summary));
  if (!matched) return summary;
  console.warn(
    `[crux] verdict-shaped summary rejected (matched ${matched}): ${summary.slice(0, 200)}`,
  );
  return hingeCount === 0
    ? "The dossier doesn't surface a single hinge — review the sub-claims below to weigh the evidence."
    : "The strength of this claim depends on the sub-claim(s) marked as crux below. Review them and the supporting sources to weigh the evidence yourself.";
}
