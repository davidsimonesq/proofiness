import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { ClaimType, Source, Steelman } from "@crux/shared-types";
import { getAnthropic, logAnthropicError } from "../lib/anthropic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "..", "prompts", "steelman.md");

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  _systemPrompt = await readFile(PROMPT_PATH, "utf8");
  return _systemPrompt;
}

const SteelmanSideSchema = z.object({
  argument: z.string(),
  sourceIds: z.array(z.string()).default([]),
});

const SteelmanSchema = z.object({
  for: SteelmanSideSchema,
  against: SteelmanSideSchema,
});

// Sub-claim types where evidence can speak both ways. Definitional and value
// judgments don't get steelmans because their disagreement isn't resolved by
// sources — surfacing a "for/against from sources" pair would mislead.
const STEELMAN_TYPES: ReadonlySet<ClaimType> = new Set([
  "empirical_fact",
  "causal",
  "comparative",
  "prediction",
]);

export function shouldSteelman(claimType: ClaimType, sources: Source[]): boolean {
  if (!STEELMAN_TYPES.has(claimType)) return false;
  // Need at least 2 sources for a steelman to be useful — one source can't
  // really anchor for-against contrast.
  return sources.length >= 2;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}

interface SteelmanInput {
  subClaim: string;
  subClaimType: ClaimType;
  sources: Source[];
}

export async function generateSteelman({
  subClaim,
  subClaimType,
  sources,
}: SteelmanInput): Promise<Steelman | null> {
  const validSourceIds = new Set(sources.map((s) => s.id));
  const client = getAnthropic();
  const system = await loadSystemPrompt();
  const model = process.env.STEELMAN_MODEL ?? "claude-sonnet-4-6";

  // Compact the source view we send to the model. Title + type + snippet is
  // enough; full text per source would inflate the prompt.
  const compactSources = sources.map((s) => ({
    id: s.id,
    title: s.title.slice(0, 200),
    sourceType: s.sourceType,
    publishedAt: s.publishedAt,
    snippet: s.snippet.slice(0, 800),
    paywalled: s.paywalled ?? false,
  }));

  const userBody = JSON.stringify(
    { subClaim, subClaimType, sources: compactSources },
    null,
    2,
  );

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 2048,
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
    logAnthropicError("steelman", subClaim.slice(0, 80), err);
    return null;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  let raw: unknown;
  try {
    raw = extractJson(textBlock.text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[steelman] invalid JSON for ${JSON.stringify(subClaim)}: ${msg}`);
    return null;
  }

  const parsed = SteelmanSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[steelman] schema validation failed: ${parsed.error.message}`);
    return null;
  }

  // Defense in depth: drop any cited sourceIds that aren't real. The model
  // should only cite ids we passed in, but if it hallucinates an id we don't
  // want the UI to render a broken reference.
  const sanitize = (side: { argument: string; sourceIds: string[] }) => ({
    argument: side.argument,
    sourceIds: side.sourceIds.filter((id) => validSourceIds.has(id)),
  });

  return {
    for: sanitize(parsed.data.for),
    against: sanitize(parsed.data.against),
  };
}
