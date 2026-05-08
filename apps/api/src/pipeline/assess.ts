import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { Assessment, Crux, SubClaim } from "@proofiness/shared-types";
import { getAnthropic, logAnthropicError } from "../lib/anthropic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "..", "prompts", "assess.md");

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  _systemPrompt = await readFile(PROMPT_PATH, "utf8");
  return _systemPrompt;
}

const AssessmentSchema = z.object({
  label: z.enum([
    "largely_supported",
    "largely_contradicted",
    "mixed",
    "definitional",
    "value_laden",
    "insufficient_evidence",
  ]),
  labelDetail: z.string().default(""),
  confidence: z.enum(["low", "moderate", "high"]),
  synthesis: z.string().min(1),
});

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}

interface AssessInput {
  claim: string;
  subClaims: SubClaim[];
  crux: Crux | null;
}

export async function assess({ claim, subClaims, crux }: AssessInput): Promise<Assessment | null> {
  if (subClaims.length === 0) return null;

  const client = getAnthropic();
  const system = await loadSystemPrompt();
  const model = process.env.ASSESS_MODEL ?? "claude-sonnet-4-6";

  // Compact view: structural + steelman shape, no full source bodies.
  const compactSubClaims = subClaims.map((sc) => ({
    text: sc.text,
    type: sc.type,
    contestation: sc.contestation?.label ?? null,
    contestationNote: sc.contestation?.note ?? null,
    sourceTypes: sc.sources.map((s) => s.sourceType),
    sourceCount: sc.sources.length,
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

  const userBody = JSON.stringify(
    {
      claim,
      subClaims: compactSubClaims,
      crux: crux ? { hingesOnCount: crux.hingesOn.length, summary: crux.summary } : null,
    },
    null,
    2,
  );

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
    logAnthropicError("assess", claim.slice(0, 80), err);
    return null;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  let raw: unknown;
  try {
    raw = extractJson(textBlock.text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assess] invalid JSON: ${msg}`);
    return null;
  }

  const parsed = AssessmentSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[assess] schema validation failed: ${parsed.error.message}`);
    return null;
  }

  const data = parsed.data;
  // Defense in depth: if the label requires a labelDetail (mixed/definitional)
  // and the model didn't provide one, fall back to a neutral placeholder.
  // The reverse case (detail provided when not required) is fine — UI only
  // renders the detail when the label calls for it.
  const requiresDetail = data.label === "mixed" || data.label === "definitional";
  const labelDetail = requiresDetail
    ? data.labelDetail || "see synthesis below"
    : "";

  return {
    label: data.label,
    labelDetail,
    confidence: data.confidence,
    synthesis: data.synthesis,
  };
}
