import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { ProgressEvent } from "@proofiness/shared-types";
import { assembleDossier } from "../pipeline/assemble-dossier.js";
import { ClaimRejectedError } from "../pipeline/normalize.js";
import { saveDossier, getDossier, listDossiers, type ListCursor } from "../lib/db.js";

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
    const parsed = CreateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const { claim, context } = parsed.data;

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

    try {
      const dossier = await assembleDossier(claim, context, emit);
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
