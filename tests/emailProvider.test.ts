import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EmailServiceError,
  getEmailServiceConfig,
  sendEmail
} from "../src/server/emailProvider.js";

describe("getEmailServiceConfig", () => {
  it("returns null until both email service variables are present", () => {
    assert.equal(getEmailServiceConfig({}), null);
    assert.equal(
      getEmailServiceConfig({
        MCTAI_EMAIL_URL: "https://email.example/send"
      }),
      null
    );
  });

  it("reads the Ideavibes email endpoint and app token", () => {
    assert.deepEqual(
      getEmailServiceConfig({
        MCTAI_EMAIL_URL: " https://email.example/send ",
        MCTAI_EMAIL_APP_TOKEN: " app-token "
      }),
      {
        url: "https://email.example/send",
        appToken: "app-token"
      }
    );
  });
});

describe("sendEmail", () => {
  it("skips delivery when the email service is not configured", async () => {
    assert.deepEqual(
      await sendEmail(
        {
          to: "person@example.com",
          subject: "Hello",
          text: "Message"
        },
        { env: {} }
      ),
      {
        delivered: false,
        reason: "email_service_not_configured"
      }
    );
  });

  it("posts the expected payload to the Ideavibes email service", async () => {
    let requestedUrl: string | URL | Request | undefined;
    let requestedInit: RequestInit | undefined;

    const fetchImpl: typeof fetch = async (input, init) => {
      requestedUrl = input;
      requestedInit = init;
      return new Response(JSON.stringify({ id: "msg_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    const result = await sendEmail(
      {
        to: "person@example.com",
        subject: "Hello",
        text: "Message",
        replyTo: "reply@example.com"
      },
      {
        env: {
          MCTAI_EMAIL_URL: "https://email.example/send",
          MCTAI_EMAIL_APP_TOKEN: "app-token"
        },
        fetchImpl
      }
    );

    assert.deepEqual(result, { delivered: true, messageId: "msg_123" });
    assert.equal(requestedUrl, "https://email.example/send");
    assert.equal(requestedInit?.method, "POST");
    assert.deepEqual(requestedInit?.headers, {
      Authorization: "Bearer app-token",
      "Content-Type": "application/json"
    });
    assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
      to: "person@example.com",
      subject: "Hello",
      text: "Message",
      reply_to: "reply@example.com"
    });
  });

  it("throws a rate limit error for 429 responses", async () => {
    await assert.rejects(
      () =>
        sendEmail(
          {
            to: "person@example.com",
            subject: "Hello",
            text: "Message"
          },
          {
            env: {
              MCTAI_EMAIL_URL: "https://email.example/send",
              MCTAI_EMAIL_APP_TOKEN: "app-token"
            },
            fetchImpl: async () => new Response("Too many", { status: 429 })
          }
        ),
      (error) =>
        error instanceof EmailServiceError &&
        error.code === "rate_limited" &&
        error.status === 429
    );
  });

  it("throws an invalid response error when the service omits an id", async () => {
    await assert.rejects(
      () =>
        sendEmail(
          {
            to: "person@example.com",
            subject: "Hello",
            text: "Message"
          },
          {
            env: {
              MCTAI_EMAIL_URL: "https://email.example/send",
              MCTAI_EMAIL_APP_TOKEN: "app-token"
            },
            fetchImpl: async () =>
              new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
              })
          }
        ),
      (error) =>
        error instanceof EmailServiceError &&
        error.code === "invalid_response"
    );
  });
});
