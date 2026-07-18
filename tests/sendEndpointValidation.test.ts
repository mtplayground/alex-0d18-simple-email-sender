import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSendEmailRequest } from "../src/server/sendEndpoint.js";

describe("validateSendEmailRequest", () => {
  it("rejects missing request bodies", () => {
    assert.deepEqual(validateSendEmailRequest(null), {
      ok: false,
      error: "Enter a recipient, subject, and message."
    });
  });

  it("rejects invalid recipient addresses", () => {
    assert.deepEqual(
      validateSendEmailRequest({
        recipient: "not-an-email",
        subject: "Hello",
        message: "Testing"
      }),
      {
        ok: false,
        error: "Enter a valid recipient email address."
      }
    );
  });

  it("rejects overlong subjects and messages", () => {
    assert.deepEqual(
      validateSendEmailRequest({
        recipient: "person@example.com",
        subject: "x".repeat(141),
        message: "Testing"
      }),
      {
        ok: false,
        error: "Keep the subject under 140 characters."
      }
    );

    assert.deepEqual(
      validateSendEmailRequest({
        recipient: "person@example.com",
        subject: "Hello",
        message: "x".repeat(5001)
      }),
      {
        ok: false,
        error: "Keep the message under 5,000 characters."
      }
    );
  });

  it("trims and accepts a complete email draft", () => {
    assert.deepEqual(
      validateSendEmailRequest({
        recipient: " person@example.com ",
        subject: " Hello ",
        message: " Message body "
      }),
      {
        ok: true,
        data: {
          recipient: "person@example.com",
          subject: "Hello",
          message: "Message body"
        }
      }
    );
  });
});
