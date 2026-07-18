import type { ErrorRequestHandler, RequestHandler } from "express";
import type {
  SendEmailFailure,
  SendEmailRequest,
  SendEmailResponse
} from "../shared/email.js";
import { EmailServiceError, sendEmail } from "./emailProvider.js";

type ValidatedSendEmailRequest =
  | (SendEmailFailure & { data?: never })
  | { ok: true; data: SendEmailRequest };

export const sendEmailHandler: RequestHandler = async (req, res) => {
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
};

export const handleJsonParseError: ErrorRequestHandler = (
  error,
  _req,
  res,
  next
) => {
  if (!isJsonSyntaxError(error)) {
    next(error);
    return;
  }

  res.status(400).json({
    ok: false,
    error: "Request body must be valid JSON."
  } satisfies SendEmailResponse);
};

function validateSendEmailRequest(body: unknown): ValidatedSendEmailRequest {
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

function isJsonSyntaxError(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) {
    return false;
  }

  return (
    typeof (error as { status?: unknown }).status === "number" &&
    (error as { status?: number }).status === 400 &&
    "body" in error
  );
}
