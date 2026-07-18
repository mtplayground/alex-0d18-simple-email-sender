import type {
  SendEmailRequest,
  SendEmailResponse
} from "../shared/email";

export async function sendEmailDraft(
  draft: SendEmailRequest
): Promise<SendEmailResponse> {
  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      recipient: draft.recipient.trim(),
      subject: draft.subject.trim(),
      message: draft.message.trim()
    } satisfies SendEmailRequest)
  });

  const result = await readSendEmailResponse(response);

  if (!response.ok && result.ok) {
    return {
      ok: false,
      error: "The email could not be sent. Please try again."
    };
  }

  return result;
}

async function readSendEmailResponse(
  response: Response
): Promise<SendEmailResponse> {
  const body: unknown = await response.json().catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "ok" in body &&
    body.ok === true &&
    "messageId" in body &&
    typeof body.messageId === "string" &&
    body.messageId.trim()
  ) {
    return {
      ok: true,
      messageId: body.messageId
    };
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "ok" in body &&
    body.ok === false &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error.trim()
  ) {
    return {
      ok: false,
      error: body.error
    };
  }

  return {
    ok: false,
    error: "The email service returned an unexpected response."
  };
}
