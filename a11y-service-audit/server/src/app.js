import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { statusRouter } from "./routes/status.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json());

  // API boundary: everything under /api is JSON only
  app.use("/api/status", statusRouter);
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Client boundary: static files, no server-side rendering
  app.use(express.static(path.join(__dirname, "../../client")));
  return app;
}
