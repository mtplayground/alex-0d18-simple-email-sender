import express from "express";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isEmailServiceConfigured } from "./emailProvider.js";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const serverDir = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(serverDir, "../client");
const indexFile = join(clientDir, "index.html");

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    emailService: isEmailServiceConfigured() ? "configured" : "not_configured"
  });
});

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

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${port}`);
});
