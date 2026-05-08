import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { dossierRoutes } from "./routes/dossier.js";

const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

async function main(): Promise<void> {
  const app = Fastify({
    // Per-request UUID surfaced in every log line via Pino's request-scoped
    // logger (req.log) and echoed in the x-request-id response header. The
    // SSE error event includes it too — when something breaks, the user can
    // copy a single id and that finds the matching server logs.
    genReqId: () => randomUUID(),
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      // Echo reqId in response header so non-SSE 4xx/5xx errors are also greppable.
      serializers: {
        req: (req) => ({ method: req.method, url: req.url, reqId: req.id }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    },
    bodyLimit: 1024 * 1024,
  });

  app.addHook("onSend", (req, reply, _payload, done) => {
    reply.header("x-request-id", req.id);
    done();
  });

  await app.register(cors, { origin: WEB_ORIGIN });

  // Global default rate limit — per-route overrides for the expensive endpoint
  // live in routes/dossier.ts. Per-IP keying is fine for single-instance dev;
  // any deployed instance would want auth + per-account keying instead.
  await app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
    cache: 10_000,
  });

  app.get("/health", async () => ({ ok: true }));
  await app.register(dossierRoutes);

  try {
    await app.listen({ port: PORT, host: "127.0.0.1" });
    app.log.info(`crux api listening on http://127.0.0.1:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
