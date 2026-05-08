import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { ClaimType } from "@proofiness/shared-types";
import { getAnthropic, logAnthropicError } from "../lib/anthropic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "..", "prompts", "decompose.md");

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  _systemPrompt = await readFile(PROMPT_PATH, "utf8");
  return _systemPrompt;
}

const ClaimTypeSchema = z.enum([
  "empirical_fact",
  "causal",
  "definitional",
  "value_judgment",
  "prediction",
  "comparative",
]);

// `searchQueries` is an array per spec §3.3 (multi-framing search). Empty array
// is valid for non-searchable sub-claims (definitional / value_judgment).
// Cap at 5 to bound cost — anything beyond 5 framings is over-design.
const DecompositionSchema = z.object({
  subClaims: z
    .array(
      z.object({
        text: z.string().min(1),
        type: ClaimTypeSchema,
        searchQueries: z.array(z.string()).max(5).default([]),
      }),
    )
    .min(1),
  embeddedAssumptions: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
});

export type Decomposition = z.infer<typeof DecompositionSchema>;
export type DecomposedSubClaim = Decomposition["subClaims"][number];

function extractJson(text: string): unknown {
  // Model may wrap JSON in fences despite instructions. Strip them.
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenceMatch?.[1] ?? trimmed;
  return JSON.parse(candidate);
}

export async function decompose(claim: string, context?: string): Promise<Decomposition> {
  const client = getAnthropic();
  const system = await loadSystemPrompt();
  const model = process.env.DECOMPOSE_MODEL ?? "claude-sonnet-4-6";

  const userBody = context ? `Claim: ${claim}\n\nWhere the user encountered it: ${context}` : `Claim: ${claim}`;

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 4096,
      // Cache the system prompt — it's reused across every decomposition request.
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
    const cat = logAnthropicError("decompose", claim.slice(0, 80), err);
    // Decompose is the load-bearing first step — propagate so the SSE error
    // event surfaces a clear category-tagged failure to the user.
    throw new Error(`Decomposition failed (${cat.category}): ${cat.message}`);
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Decomposition LLM returned no text content");
  }

  let raw: unknown;
  try {
    raw = extractJson(textBlock.text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Decomposition LLM returned invalid JSON: ${msg}\n---\n${textBlock.text.slice(0, 500)}`);
  }

  const parsed = DecompositionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Decomposition LLM output failed schema validation: ${parsed.error.message}\n---\n${JSON.stringify(raw).slice(0, 500)}`,
    );
  }
  return parsed.data;
}

// Re-export for downstream pipeline modules.
export type { ClaimType };
