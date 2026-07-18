import express from "express";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isEmailServiceConfigured } from "./emailProvider.js";
import { handleJsonParseError, sendEmailHandler } from "./sendEndpoint.js";

type CreateAppOptions = {
  clientDir?: string;
};

export function createApp(options: CreateAppOptions = {}) {
  const serverDir = dirname(fileURLToPath(import.meta.url));
  const clientDir = options.clientDir ?? resolve(serverDir, "../client");
  const indexFile = join(clientDir, "index.html");
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(handleJsonParseError);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      emailService: isEmailServiceConfigured() ? "configured" : "not_configured"
    });
  });

  app.post("/api/send-email", sendEmailHandler);

  if (existsSync(clientDir)) {
    app.use(express.static(clientDir, { index: false }));
  }

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }

    if (!existsSync(indexFile)) {
      res.status(503).json({ ok: false, error: "Client build is unavailable" });
      return;
    }

    res.sendFile(indexFile);
  });

  return app;
}
