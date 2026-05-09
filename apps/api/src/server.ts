import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { dossierRoutes } from "./routes/dossier.js";
import { requestInviteRoutes } from "./routes/request-invite.js";

// In production (e.g. Railway, Docker, any container platform), bind to all
// interfaces so the platform's load balancer can reach us. In local dev,
// default to 127.0.0.1 so we don't accidentally expose the API on the LAN.
const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const HOST = process.env.HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

// WEB_ORIGIN accepts a single origin or a comma-separated list. The list form
// matters for production: same dossier instance might be reachable via
// proofiness.org AND www.proofiness.org, both of which need CORS clearance.
const WEB_ORIGIN_RAW = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const WEB_ORIGINS = WEB_ORIGIN_RAW.split(",").map((s) => s.trim()).filter(Boolean);

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
    // Trust the platform's load balancer for client IPs (Railway, Cloudflare,
    // etc. set X-Forwarded-For). Without this the rate-limit / quota
    // attribution sees the LB IP as every client.
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  app.addHook("onSend", (req, reply, _payload, done) => {
    reply.header("x-request-id", req.id);
    done();
  });

  // CORS: pass an array if multiple origins, a string if just one. Allow the
  // x-invite-code header (cost gate) and the x-anthropic-key / x-tavily-key
  // headers (BYOK) so the browser preflight succeeds in cross-origin deploys.
  await app.register(cors, {
    origin: WEB_ORIGINS.length === 1 ? WEB_ORIGINS[0] : WEB_ORIGINS,
    allowedHeaders: [
      "content-type",
      "accept",
      "x-invite-code",
      "x-anthropic-key",
      "x-tavily-key",
    ],
    exposedHeaders: ["x-request-id"],
  });

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
  await app.register(requestInviteRoutes);

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`proofiness api listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
