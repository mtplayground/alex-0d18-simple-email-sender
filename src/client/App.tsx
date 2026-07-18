import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { SendEmailRequest } from "../shared/email";
import { sendEmailDraft } from "./sendEmail";

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success"; messageId: string }
  | { status: "error"; message: string };

const initialDraft: SendEmailRequest = {
  recipient: "",
  subject: "",
  message: ""
};

export function App() {
  const [draft, setDraft] = useState<SendEmailRequest>(initialDraft);
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });

  const canSubmit = useMemo(
    () =>
      draft.recipient.trim() !== "" &&
      draft.subject.trim() !== "" &&
      draft.message.trim() !== "" &&
      sendState.status !== "sending",
    [draft, sendState.status]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setSendState({
        status: "error",
        message: "Enter a recipient, subject, and message."
      });
      return;
    }

    setSendState({ status: "sending" });

    try {
      const result = await sendEmailDraft(draft);

      if (!result.ok) {
        setSendState({
          status: "error",
          message: result.error
        });
        return;
      }

      setDraft(initialDraft);
      setSendState({ status: "success", messageId: result.messageId });
    } catch {
      setSendState({
        status: "error",
        message: "The email could not be sent. Check your connection and try again."
      });
    }
  }

  return (
    <main className="page-shell">
      <section className="email-composer" aria-labelledby="page-title">
        <div className="intro">
          <p className="eyebrow">Simple email sender</p>
          <h1 id="page-title">Send a plain email.</h1>
          <p className="summary">
            Add one recipient, a subject, and a short message. The server sends
            it through the configured Ideavibes email service.
          </p>
        </div>

        <form
          aria-busy={sendState.status === "sending"}
          className="email-form"
          onSubmit={handleSubmit}
        >
          <label className="field">
            <span>Recipient</span>
            <input
              autoComplete="email"
              inputMode="email"
              name="recipient"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  recipient: event.target.value
                }))
              }
              placeholder="name@example.com"
              required
              type="email"
              value={draft.recipient}
            />
          </label>

          <label className="field">
            <span>Subject</span>
            <input
              maxLength={140}
              name="subject"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  subject: event.target.value
                }))
              }
              placeholder="What is this about?"
              required
              type="text"
              value={draft.subject}
            />
          </label>

          <label className="field">
            <span>Message</span>
            <textarea
              maxLength={5000}
              name="message"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  message: event.target.value
                }))
              }
              placeholder="Write your message..."
              required
              rows={8}
              value={draft.message}
            />
          </label>

          <div className="form-actions">
            <button disabled={!canSubmit} type="submit">
              {sendState.status === "sending" ? "Sending..." : "Send"}
            </button>
            <p className={`status ${sendState.status}`} aria-live="polite">
              {sendState.status === "success"
                ? `Email sent. Message ID: ${sendState.messageId}`
                : sendState.status === "error"
                  ? sendState.message
                  : ""}
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
