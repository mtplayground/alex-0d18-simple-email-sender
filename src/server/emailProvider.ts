export type EmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
};

export type EmailSendResult =
  | {
      delivered: true;
      messageId: string;
    }
  | {
      delivered: false;
      reason: "email_service_not_configured";
    };

export type EmailServiceErrorCode =
  | "rate_limited"
  | "send_failed"
  | "invalid_response";

export class EmailServiceError extends Error {
  readonly code: EmailServiceErrorCode;
  readonly status?: number;

  constructor(message: string, code: EmailServiceErrorCode, status?: number) {
    super(message);
    this.name = "EmailServiceError";
    this.code = code;
    this.status = status;
  }
}

type EmailServiceConfig = {
  url: string;
  appToken: string;
};

type SendEmailOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
};

export function getEmailServiceConfig(
  env: NodeJS.ProcessEnv = process.env
): EmailServiceConfig | null {
  const url = env.MCTAI_EMAIL_URL?.trim();
  const appToken = env.MCTAI_EMAIL_APP_TOKEN?.trim();

  if (!url || !appToken) {
    return null;
  }

  return { url, appToken };
}

export function isEmailServiceConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return getEmailServiceConfig(env) !== null;
}

export async function sendEmail(
  payload: EmailPayload,
  options: SendEmailOptions = {}
): Promise<EmailSendResult> {
  const config = getEmailServiceConfig(options.env);

  if (!config) {
    return { delivered: false, reason: "email_service_not_configured" };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.appToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      ...(payload.replyTo ? { reply_to: payload.replyTo } : {})
    })
  });

  if (response.status === 429) {
    throw new EmailServiceError(
      "Email service is rate limited; try again shortly",
      "rate_limited",
      response.status
    );
  }

  if (!response.ok) {
    throw new EmailServiceError(
      `Email service returned ${response.status}: ${await readResponseBody(response)}`,
      "send_failed",
      response.status
    );
  }

  const messageId = await readMessageId(response);
  return { delivered: true, messageId };
}

async function readMessageId(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "id" in body &&
    typeof body.id === "string" &&
    body.id.trim()
  ) {
    return body.id;
  }

  throw new EmailServiceError(
    "Email service response did not include a message id",
    "invalid_response",
    response.status
  );
}

async function readResponseBody(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
}
