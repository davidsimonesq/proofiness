import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import { getAnthropic, logAnthropicError } from "../lib/anthropic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "..", "prompts", "normalize.md");

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  _systemPrompt = await readFile(PROMPT_PATH, "utf8");
  return _systemPrompt;
}

const NormalizeSchema = z.object({
  status: z.enum(["ok", "too_vague", "not_a_claim"]),
  normalizedClaim: z.string().optional(),
  reason: z.string().optional(),
  suggestions: z.array(z.string()).default([]),
});

export type NormalizeResult =
  | { status: "ok"; normalizedClaim: string }
  | { status: "too_vague" | "not_a_claim"; reason: string; suggestions: string[] };

// Thrown when the claim can't proceed to decomposition. Caught by the route
// handler to emit a specific SSE error event with refinement suggestions.
export class ClaimRejectedError extends Error {
  constructor(
    public readonly status: "too_vague" | "not_a_claim",
    public readonly reason: string,
    public readonly suggestions: string[],
  ) {
    super(`claim rejected: ${status}`);
    this.name = "ClaimRejectedError";
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}

// Returns the normalized claim. Throws ClaimRejectedError if the input isn't
// suitable for decomposition. Defensive: if the LLM call fails, fall through
// with the original claim — better to attempt the dossier than to gate on this
// upstream check.
export async function normalize(claim: string): Promise<string> {
  const client = getAnthropic();
  const system = await loadSystemPrompt();
  const model = process.env.NORMALIZE_MODEL ?? "claude-haiku-4-5";

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
      messages: [{ role: "user", content: claim }],
    });
  } catch (err) {
    logAnthropicError("normalize", claim.slice(0, 80), err);
    return claim;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return claim;

  let raw: unknown;
  try {
    raw = extractJson(textBlock.text);
  } catch {
    console.error(`[normalize] invalid JSON, proceeding with original claim`);
    return claim;
  }

  const parsed = NormalizeSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[normalize] schema validation failed, proceeding: ${parsed.error.message}`);
    return claim;
  }

  const data = parsed.data;
  if (data.status === "ok") {
    return data.normalizedClaim?.trim() || claim;
  }
  // too_vague or not_a_claim — caller surfaces this to the user via SSE
  throw new ClaimRejectedError(
    data.status,
    data.reason ?? "The claim couldn't be processed for decomposition.",
    data.suggestions,
  );
}
