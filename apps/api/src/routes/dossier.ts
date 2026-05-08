import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { ProgressEvent } from "@proofiness/shared-types";
import { assembleDossier } from "../pipeline/assemble-dossier.js";
import { ClaimRejectedError } from "../pipeline/normalize.js";
import { saveDossier, getDossier, listDossiers, type ListCursor } from "../lib/db.js";
import { checkInviteAndConsume } from "../lib/invites.js";
import { requestContext } from "../lib/request-context.js";

// Pulls BYOK headers from the request. Returns both keys when both are
// present (BYOK mode); returns null when neither is present (embedded mode);
// throws "partial" when exactly one is provided so the route returns 400.
function readByokHeaders(headers: Record<string, string | string[] | undefined>): { mode: "byok"; anthropicKey: string; tavilyKey: string } | { mode: "embedded" } | { mode: "partial"; missing: string } {
  const aRaw = headers["x-anthropic-key"];
  const tRaw = headers["x-tavily-key"];
  const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw)?.trim();
  const t = (Array.isArray(tRaw) ? tRaw[0] : tRaw)?.trim();
  if (a && t) return { mode: "byok", anthropicKey: a, tavilyKey: t };
  if (!a && !t) return { mode: "embedded" };
  return { mode: "partial", missing: a ? "x-tavily-key" : "x-anthropic-key" };
}

const CreateRequestSchema = z.object({
  claim: z.string().trim().min(3, "Claim is too short").max(4000, "Claim is too long"),
  context: z.string().trim().max(4000).optional(),
});

// SSE event names (used by client parser). Stable strings are part of the wire contract.
const EVT_PROGRESS = "progress";
const EVT_DONE = "done";
const EVT_ERROR = "error";

function writeSse(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function dossierRoutes(app: FastifyInstance): Promise<void> {
  // Streaming dossier generation. Server emits progress events as the pipeline
  // runs and a final `done` event with the full dossier. Client uses fetch +
  // ReadableStream to consume.
  //
  // Rate-limited tighter than the global default — each call burns 8-12 LLM
  // calls + multiple search/fetch ops. 5/min/IP is enough for active solo dev,
  // catches runaway clients before they drain Anthropic + Tavily credits.
  app.post("/api/dossier", {
    config: {
      rateLimit: { max: 5, timeWindow: "1 minute" },
    },
  }, async (req, reply) => {
    // BYOK mode: user supplies their own Anthropic + Tavily keys via headers.
    // When both are present, the cost gate is bypassed (user is paying their
    // own provider directly). When neither is present, the embedded keys are
    // used and the cost gate applies. Exactly one is treated as a config
    // mistake — return 400 rather than silently using the embedded key for
    // the missing side.
    const byok = readByokHeaders(req.headers);
    if (byok.mode === "partial") {
      return reply.code(400).send({
        error: "byok_incomplete",
        detail: `Both x-anthropic-key and x-tavily-key are required to use your own keys. Missing: ${byok.missing}.`,
      });
    }

    // Validate the request body BEFORE consuming quota — malformed requests
    // shouldn't burn an invite code's lifetime allotment.
    const parsed = CreateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const { claim, context } = parsed.data;

    if (byok.mode === "embedded") {
      // Cost gate: invite-code check + per-code lifetime dossier quota. When
      // INVITE_CODES env is empty (local dev), this is a no-op. Runs AFTER
      // body validation so a malformed request doesn't cost a quota slot.
      const inviteCode = req.headers["x-invite-code"];
      const inviteCodeStr = Array.isArray(inviteCode) ? inviteCode[0] : inviteCode;
      const gate = checkInviteAndConsume(inviteCodeStr);
      if (!gate.ok) {
        return reply
          .code(gate.status)
          .send({ error: gate.status === 401 ? "invite_required" : "quota_exceeded", detail: gate.reason });
      }
    }

    // SSE response headers — disable proxy/server buffering so events flush immediately.
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    // Heartbeat every 15s so intermediaries don't drop the connection during
    // long LLM calls. Comment lines in SSE are ignored by the client parser.
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: heartbeat\n\n`);
      } catch {
        // socket already closed — interval cleared in the finally block below
      }
    }, 15_000);

    const emit = (event: ProgressEvent) => {
      writeSse(reply, EVT_PROGRESS, event);
    };

    // Scope the BYOK keys (if any) to this request via AsyncLocalStorage. When
    // mode === "embedded", the store is empty and getAnthropic()/getSearchProvider()
    // fall back to the env keys.
    const ctxKeys = byok.mode === "byok"
      ? { anthropicKey: byok.anthropicKey, tavilyKey: byok.tavilyKey }
      : {};

    try {
      const dossier = await requestContext.run(ctxKeys, () =>
        assembleDossier(claim, context, emit),
      );
      emit({ step: "persisting", message: "Saving dossier…" });
      saveDossier(dossier);
      writeSse(reply, EVT_DONE, { dossier });
    } catch (err) {
      // Normalization rejected the claim — emit a structured error the client
      // can render with refinement suggestions, distinct from generic failure.
      if (err instanceof ClaimRejectedError) {
        writeSse(reply, EVT_ERROR, {
          error: err.status, // "too_vague" | "not_a_claim"
          detail: err.reason,
          suggestions: err.suggestions,
          requestId: req.id,
        });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        req.log.error({ err }, "dossier assembly failed");
        writeSse(reply, EVT_ERROR, {
          error: "dossier_failed",
          detail: msg,
          requestId: req.id,
        });
      }
    } finally {
      clearInterval(heartbeat);
      reply.raw.end();
    }
  });

  // Fetch a saved dossier by id (used for shareable URLs and history view).
  app.get<{ Params: { id: string } }>("/api/dossier/:id", async (req, reply) => {
    const dossier = getDossier(req.params.id);
    if (!dossier) {
      return reply.code(404).send({ error: "not_found", detail: "no dossier with that id" });
    }
    return { dossier };
  });

  // List recent dossiers (history view). Cursor-paginated. Cursor is opaque
  // base64-encoded JSON of (createdAt, id); clients pass it back unchanged.
  app.get<{ Querystring: { cursor?: string; limit?: string } }>(
    "/api/dossiers",
    async (req, reply) => {
      const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : undefined;
      let cursor: ListCursor | null = null;
      if (req.query.cursor) {
        const decoded = decodeCursor(req.query.cursor);
        if (!decoded) {
          return reply
            .code(400)
            .send({ error: "invalid_cursor", detail: "cursor is malformed" });
        }
        cursor = decoded;
      }
      const page = listDossiers({ limit, cursor });
      return {
        dossiers: page.rows,
        nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
      };
    },
  );
}

function encodeCursor(c: ListCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

function decodeCursor(s: string): ListCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as ListCursor;
    if (typeof decoded.createdAt === "string" && typeof decoded.id === "string") {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}
