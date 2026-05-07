import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { ProgressEvent } from "@crux/shared-types";
import { assembleDossier } from "../pipeline/assemble-dossier.js";
import { saveDossier, getDossier, listDossiers } from "../lib/db.js";

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
  app.post("/api/dossier", async (req, reply) => {
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
      const msg = err instanceof Error ? err.message : String(err);
      req.log.error({ err }, "dossier assembly failed");
      writeSse(reply, EVT_ERROR, { error: "dossier_failed", detail: msg });
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

  // List recent dossiers (history view). Returns summaries only.
  app.get("/api/dossiers", async () => {
    return { dossiers: listDossiers(100) };
  });
}
