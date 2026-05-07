import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { Crux, SubClaim } from "@crux/shared-types";
import { getAnthropic } from "../lib/anthropic.js";

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
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[crux] LLM call failed: ${msg}`);
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

  // Defense in depth: drop any hingesOn ids the model invented that aren't real sub-claims.
  return {
    hingesOn: parsed.data.hingesOn.filter((id) => validIds.has(id)),
    summary: parsed.data.summary,
  };
}
