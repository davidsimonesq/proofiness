// Two complementary extractors that produce CitationCandidate[]:
//   1. fromOutboundLinks(links) — adapts pre-extracted <a href>+context from fetch.ts
//   2. inferFromProse(text)     — Haiku reads the article body and names the
//                                 upstream sources mentioned by prose only.
// Both are run, then deduped (linked URLs upgrade to "linked_inferred" when an
// LLM-inferred name overlaps). Each candidate carries a resolution method so
// the tracer knows whether to use the URL directly or run a search.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { ResolutionMethod } from "@crux/shared-types";
import { getAnthropic } from "../lib/anthropic.js";
import type { OutboundLink } from "./fetch.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "..", "prompts", "extract-citations.md");

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  _systemPrompt = await readFile(PROMPT_PATH, "utf8");
  return _systemPrompt;
}

const InferredCitationSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "primary_research",
    "peer_reviewed",
    "government",
    "institutional",
    "primary_statement",
    "unknown",
  ]),
  context: z.string().default(""),
  searchQuery: z.string().default(""),
});

const InferredListSchema = z.array(InferredCitationSchema);

export interface CitationCandidate {
  // For "linked": the href from the parent article. For "inferred_searched":
  // empty until the tracer resolves it via search.
  url?: string;
  // Best label we have — anchor text, or the LLM's `name`.
  label: string;
  // Search query to resolve this when needed.
  searchQuery: string;
  // What the parent article says about this citation.
  context?: string;
  resolutionMethod: ResolutionMethod;
}

// ─── Strategy 1: adapt pre-extracted outbound links ──────────────────────────
export function fromOutboundLinks(links: OutboundLink[]): CitationCandidate[] {
  return links.map((l) => ({
    url: l.href,
    label: l.text,
    searchQuery: l.text,
    context: l.paragraphContext,
    resolutionMethod: "linked" as ResolutionMethod,
  }));
}

// ─── Strategy 2: LLM citation inference from article body text ───────────────
export async function inferFromProse(bodyText: string): Promise<CitationCandidate[]> {
  if (!bodyText.trim()) return [];
  const client = getAnthropic();
  const system = await loadSystemPrompt();
  const model = process.env.EXTRACT_CITATIONS_MODEL ?? "claude-haiku-4-5";

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
      messages: [
        {
          role: "user",
          content: `Article body:\n\n${bodyText.slice(0, 18_000)}`,
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[extract-citations] LLM call failed: ${msg}`);
    return [];
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  let raw: unknown;
  try {
    const trimmed = textBlock.text.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    raw = JSON.parse(fenceMatch?.[1] ?? trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[extract-citations] invalid JSON: ${msg}`);
    return [];
  }

  const parsed = InferredListSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[extract-citations] schema validation failed: ${parsed.error.message}`);
    return [];
  }

  return parsed.data.map(
    (c): CitationCandidate => ({
      label: c.name,
      searchQuery: c.searchQuery || c.name,
      context: c.context || undefined,
      resolutionMethod: "inferred_searched",
    }),
  );
}

// ─── Merge: dedupe linked + inferred ─────────────────────────────────────────
// If a linked anchor and an inferred name overlap (label substring match),
// upgrade to "linked_inferred" — we have higher confidence it's the right citation.
export function mergeCandidates(
  linked: CitationCandidate[],
  inferred: CitationCandidate[],
): CitationCandidate[] {
  const out: CitationCandidate[] = [...linked];
  const linkedLabelsLower = linked.map((c) => c.label.toLowerCase());

  for (const inf of inferred) {
    const infLower = inf.label.toLowerCase();
    const overlapIdx = linkedLabelsLower.findIndex(
      (lbl) =>
        lbl.length >= 4 &&
        infLower.length >= 4 &&
        (lbl.includes(infLower) || infLower.includes(lbl)),
    );
    if (overlapIdx >= 0) {
      const existing = out[overlapIdx]!;
      out[overlapIdx] = {
        ...existing,
        resolutionMethod: "linked_inferred",
        context: existing.context ?? inf.context,
        searchQuery: existing.searchQuery || inf.searchQuery,
      };
    } else {
      out.push(inf);
    }
  }
  return out;
}
