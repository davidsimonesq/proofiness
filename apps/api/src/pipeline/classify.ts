import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { ClassifierUsed, SourceType } from "@crux/shared-types";
import { getAnthropic } from "../lib/anthropic.js";
import { classifyByDomain } from "../lib/source-rules.js";
import { classifyCache } from "../lib/cache.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "..", "prompts", "classify.md");

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  _systemPrompt = await readFile(PROMPT_PATH, "utf8");
  return _systemPrompt;
}

const SourceTypeSchema = z.enum([
  "unknown",
  "primary_research",
  "peer_reviewed",
  "secondary_reporting",
  "opinion",
  "government",
  "institutional",
  "advocacy",
  "social_media",
  "aggregator",
]);

const LlmResponseSchema = z.array(
  z.object({
    id: z.string(),
    type: SourceTypeSchema,
  }),
);

export interface ClassifyInput {
  id: string;
  url: string;
  title: string;
  snippet: string;
}

export interface Classification {
  id: string;
  type: SourceType;
  classifierUsed: ClassifierUsed;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}

/**
 * Hybrid classifier:
 *   1. Run domain rules synchronously — handles the obvious 60–70% for free.
 *   2. Batch the rule-misses through Haiku 4.5 in a single LLM call.
 *   3. Anything that errors out gets `unknown` + classifierUsed: "fallback".
 *
 * Returns one Classification per input, in input order.
 */
export async function classifySources(inputs: ClassifyInput[]): Promise<Classification[]> {
  if (inputs.length === 0) return [];

  // Step 1: rules.
  const ruled: Classification[] = inputs.map((src) => {
    const ruleType = classifyByDomain(src.url);
    return ruleType !== null
      ? { id: src.id, type: ruleType, classifierUsed: "rule" as const }
      : { id: src.id, type: "unknown" as const, classifierUsed: "fallback" as const };
  });

  // Step 2: LLM for the rule-misses.
  const unknownInputs = inputs.filter((_, i) => ruled[i]!.classifierUsed === "fallback");
  if (unknownInputs.length === 0) return ruled;

  let llmResults: Map<string, SourceType>;
  try {
    llmResults = await classifyViaLlm(unknownInputs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[classify] LLM batch failed (${unknownInputs.length} sources): ${msg}`);
    // Leave the rule-misses as unknown/fallback. The dossier still ships.
    return ruled;
  }

  // Merge LLM results back in.
  return ruled.map((r) => {
    if (r.classifierUsed !== "fallback") return r;
    const llmType = llmResults.get(r.id);
    if (!llmType) return r; // LLM returned no entry for this id — leave as fallback
    return { id: r.id, type: llmType, classifierUsed: "llm" };
  });
}

// Thin convenience wrapper: classify ONE source by URL, using cache → rules → LLM.
// Used by trace-provenance where each link is fetched and classified separately.
// For batched dossier-time classification, use classifySources directly.
export async function classifyOne(input: {
  url: string;
  title: string;
  snippet: string;
}): Promise<Classification> {
  const id = input.url;
  const cached = classifyCache.get(input.url);
  if (cached) {
    const fromRule = classifyByDomain(input.url);
    return { id, type: cached, classifierUsed: fromRule === cached ? "rule" : "llm" };
  }
  const ruleType = classifyByDomain(input.url);
  if (ruleType !== null) {
    classifyCache.set(input.url, ruleType);
    return { id, type: ruleType, classifierUsed: "rule" };
  }
  const [result] = await classifySources([{ id, url: input.url, title: input.title, snippet: input.snippet }]);
  if (result && result.classifierUsed !== "fallback") {
    classifyCache.set(input.url, result.type);
  }
  return result ?? { id, type: "unknown", classifierUsed: "fallback" };
}

async function classifyViaLlm(inputs: ClassifyInput[]): Promise<Map<string, SourceType>> {
  const client = getAnthropic();
  const system = await loadSystemPrompt();
  const model = process.env.CLASSIFY_MODEL ?? "claude-haiku-4-5";

  // Truncate each snippet so the prompt stays small. Title + URL carry most signal.
  const compactInputs = inputs.map((src) => ({
    id: src.id,
    url: src.url,
    title: src.title.slice(0, 200),
    snippet: src.snippet.slice(0, 400),
  }));

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Classify these sources:\n\n${JSON.stringify(compactInputs, null, 2)}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Classification LLM returned no text content");
  }

  const raw = extractJson(textBlock.text);
  const parsed = LlmResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Classification LLM output failed schema validation: ${parsed.error.message}`);
  }

  const map = new Map<string, SourceType>();
  for (const item of parsed.data) map.set(item.id, item.type);
  return map;
}
