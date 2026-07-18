import express from "express";
import { existsSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
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
  app.use(applyProductionHeaders);
  app.use(express.json({ limit: "32kb" }));
  app.use(handleJsonParseError);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      emailService: isEmailServiceConfigured() ? "configured" : "not_configured"
    });
  });

  app.get("/api/ready", (_req, res) => {
    const ready = isEmailServiceConfigured();

    res.status(ready ? 200 : 503).json({
      ok: ready,
      emailService: ready ? "configured" : "not_configured"
    });
  });

  app.post("/api/send-email", sendEmailHandler);

  if (existsSync(clientDir)) {
    app.use(
      express.static(clientDir, {
        index: false,
        setHeaders(res, path) {
          if (path.includes(`${sep}assets${sep}`)) {
            res.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable"
            );
          }
        }
      })
    );
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

    res.setHeader("Cache-Control", "no-store");
    res.sendFile(indexFile);
  });

  return app;
}

function applyProductionHeaders(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self'"
    ].join("; ")
  );
  next();
}
