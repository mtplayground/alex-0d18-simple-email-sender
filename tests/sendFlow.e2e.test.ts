import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/server/app.js";

type CapturedEmailRequest = {
  authorization: string | undefined;
  body: unknown;
};

describe("email send flow", () => {
  const previousEmailUrl = process.env.MCTAI_EMAIL_URL;
  const previousEmailToken = process.env.MCTAI_EMAIL_APP_TOKEN;
  const capturedRequests: CapturedEmailRequest[] = [];

  let mockEmailServer: ReturnType<typeof createServer>;
  let appServer: ReturnType<ReturnType<typeof createApp>["listen"]>;
  let appUrl = "";

  before(async () => {
    mockEmailServer = createServer(async (req, res) => {
      capturedRequests.push({
        authorization: req.headers.authorization,
        body: await readJsonBody(req)
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "msg_e2e_123" }));
    });

    await listen(mockEmailServer);
    const mockEmailAddress = mockEmailServer.address() as AddressInfo;

    process.env.MCTAI_EMAIL_URL = `http://127.0.0.1:${mockEmailAddress.port}/send`;
    process.env.MCTAI_EMAIL_APP_TOKEN = "test-app-token";

    const app = createApp({ clientDir: resolve(process.cwd(), "dist/client") });
    appServer = app.listen(0, "127.0.0.1");
    await waitForListening(appServer);

    const appAddress = appServer.address() as AddressInfo;
    appUrl = `http://127.0.0.1:${appAddress.port}`;
  });

  after(async () => {
    restoreEnv("MCTAI_EMAIL_URL", previousEmailUrl);
    restoreEnv("MCTAI_EMAIL_APP_TOKEN", previousEmailToken);

    await closeServer(appServer);
    await closeServer(mockEmailServer);
  });

  it("serves the one-page app", async () => {
    const response = await fetch(appUrl);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(html, /<div id="root"><\/div>/);
  });

  it("reports readiness when email delivery is configured", async () => {
    const response = await fetch(`${appUrl}/api/ready`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      emailService: "configured"
    });
  });

  it("sends a form draft through the configured email service", async () => {
    const response = await fetch(`${appUrl}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: "person@example.com",
        subject: "E2E hello",
        message: "This message should reach the email service."
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      messageId: "msg_e2e_123"
    });

    assert.equal(capturedRequests.length, 1);
    assert.deepEqual(capturedRequests[0], {
      authorization: "Bearer test-app-token",
      body: {
        to: "person@example.com",
        subject: "E2E hello",
        text: "This message should reach the email service."
      }
    });
  });
});

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function waitForListening(
  server: ReturnType<ReturnType<typeof createApp>["listen"]>
): Promise<void> {
  if (server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolveListening, rejectListening) => {
    server.once("error", rejectListening);
    server.once("listening", () => {
      server.off("error", rejectListening);
      resolveListening();
    });
  });
}

function closeServer(
  server: ReturnType<typeof createServer> | ReturnType<ReturnType<typeof createApp>["listen"]>
): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
  });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
