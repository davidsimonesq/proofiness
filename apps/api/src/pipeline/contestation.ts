import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { ClaimType, ContestationLabel, Source, Steelman } from "@crux/shared-types";
import { getAnthropic } from "../lib/anthropic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "..", "prompts", "contestation.md");

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  _systemPrompt = await readFile(PROMPT_PATH, "utf8");
  return _systemPrompt;
}

const ContestationSchema = z.object({
  label: z.enum([
    "empirically_settled",
    "contested_with_evidence",
    "contested_by_faction",
    "definitional_dispute",
    "value_laden",
    "unresolvable_unknown",
  ]),
  note: z.string().min(1),
});

interface ContestationInput {
  subClaim: string;
  subClaimType: ClaimType;
  sources: Source[];
  steelman?: Steelman;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}

// Rule-classify by sub-claim type for the two categories where the type alone
// determines the label. value_judgment is always value_laden; definitional is
// always definitional_dispute. The LLM doesn't add information here.
export function ruleClassify(claimType: ClaimType): ContestationLabel | null {
  if (claimType === "value_judgment") {
    return {
      label: "value_laden",
      note: "Value judgment — no amount of evidence resolves this. Both sides could agree on every empirical fact and still disagree.",
    };
  }
  if (claimType === "definitional") {
    return {
      label: "definitional_dispute",
      note: "Definitional — the disagreement is about how a contested term is defined, not about what's empirically true.",
    };
  }
  return null;
}

export async function classifyContestation({
  subClaim,
  subClaimType,
  sources,
  steelman,
}: ContestationInput): Promise<ContestationLabel | null> {
  // Rule first.
  const ruled = ruleClassify(subClaimType);
  if (ruled) return ruled;

  // No sources at all → can't classify by evidence; return unresolvable_unknown.
  if (sources.length === 0) {
    return {
      label: "unresolvable_unknown",
      note: "No sources retrieved for this sub-claim. Either the search returned nothing or the question is too vague to query — either way the dossier doesn't have evidence to evaluate the disagreement structure.",
    };
  }

  const client = getAnthropic();
  const system = await loadSystemPrompt();
  const model = process.env.CONTESTATION_MODEL ?? "claude-sonnet-4-6";

  const userBody = JSON.stringify(
    {
      subClaim,
      subClaimType,
      // Just type counts — the steelman summary already captures the substance.
      sourceTypes: sources.map((s) => s.sourceType),
      steelman: steelman
        ? {
            for: {
              argument: steelman.for.argument,
              sourceCount: steelman.for.sourceIds.length,
            },
            against: {
              argument: steelman.against.argument,
              sourceCount: steelman.against.sourceIds.length,
            },
          }
        : null,
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[contestation] LLM call failed for ${JSON.stringify(subClaim)}: ${msg}`);
    return null;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  let raw: unknown;
  try {
    raw = extractJson(textBlock.text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[contestation] invalid JSON: ${msg}`);
    return null;
  }

  const parsed = ContestationSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[contestation] schema validation failed: ${parsed.error.message}`);
    return null;
  }
  return parsed.data;
}
