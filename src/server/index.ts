import express from "express";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  SendEmailFailure,
  SendEmailRequest,
  SendEmailResponse
} from "../shared/email.js";
import {
  EmailServiceError,
  isEmailServiceConfigured,
  sendEmail
} from "./emailProvider.js";

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

app.post("/api/send-email", async (req, res) => {
  const validation = validateSendEmailRequest(req.body);

  if (!validation.ok) {
    res.status(400).json(validation);
    return;
  }

  try {
    const result = await sendEmail({
      to: validation.data.recipient,
      subject: validation.data.subject,
      text: validation.data.message
    });

    if (!result.delivered) {
      res.status(503).json({
        ok: false,
        error: "Email delivery is not configured for this environment."
      } satisfies SendEmailResponse);
      return;
    }

    res.status(200).json({
      ok: true,
      messageId: result.messageId
    } satisfies SendEmailResponse);
  } catch (error) {
    if (error instanceof EmailServiceError && error.code === "rate_limited") {
      res.status(429).json({
        ok: false,
        error: "Email sending is temporarily rate limited. Try again shortly."
      } satisfies SendEmailResponse);
      return;
    }

    console.error("Email send failed", error);
    res.status(502).json({
      ok: false,
      error: "The email could not be sent. Please try again."
    } satisfies SendEmailResponse);
  }
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

function validateSendEmailRequest(
  body: unknown
): (SendEmailFailure & { data?: never }) | { ok: true; data: SendEmailRequest } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Enter a recipient, subject, and message." };
  }

  const draft = body as Record<string, unknown>;
  const recipient = normalizeText(draft.recipient);
  const subject = normalizeText(draft.subject);
  const message = normalizeText(draft.message);

  if (!recipient || !subject || !message) {
    return { ok: false, error: "Enter a recipient, subject, and message." };
  }

  if (recipient.length > 320 || !isEmailAddress(recipient)) {
    return { ok: false, error: "Enter a valid recipient email address." };
  }

  if (subject.length > 140) {
    return { ok: false, error: "Keep the subject under 140 characters." };
  }

  if (message.length > 5000) {
    return { ok: false, error: "Keep the message under 5,000 characters." };
  }

  return {
    ok: true,
    data: {
      recipient,
      subject,
      message
    }
  };
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
