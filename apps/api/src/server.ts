import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { dossierRoutes } from "./routes/dossier.js";

const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    bodyLimit: 1024 * 1024,
  });

  await app.register(cors, { origin: WEB_ORIGIN });

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
