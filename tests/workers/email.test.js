import { describe, it, expect, vi } from "vitest";
import { env } from "cloudflare:test";

vi.mock("../../workers/shared/db.js", () => ({
  DB: {
    checkDedupe: vi.fn(async () => true),
    insertMessage: vi.fn(async () => {}),
    insertAttachments: vi.fn(async () => {}),
    getMessage: vi.fn(async (db, messageId) => ({
      id: messageId,
      received_at: Date.now(),
      tag_checked_at: null,
      from_addr: "sender@example.com",
      to_addr: "recipient@example.com",
      subject: "Test",
      text_body: "Hello",
    })),
    getTags: vi.fn(async () => []),
    updateTagInfo: vi.fn(async () => {}),
  },
}));

vi.mock("../../workers/shared/r2.js", () => ({
  R2: {
    saveRawEmail: vi.fn(async () => "raw/test.eml"),
    saveAttachment: vi.fn(async () => "attachments/test.bin"),
  },
}));

vi.mock("../../workers/shared/mime.js", () => ({
  MimeParser: {
    parse: vi.fn(async () => ({
      messageId: "test-message-id",
      allHeaders: { "message-id": "test-message-id" },
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Hello",
      date: new Date().toISOString(),
      snippet: "Hello",
      attachments: [],
      textBody: "Hello",
      htmlBody: null,
    })),
  },
}));

vi.mock("../../workers/shared/openai.js", () => ({
  MessageClassifier: {
    classify: vi.fn(async () => null),
  },
}));

describe("email worker", () => {
  it("processes inbound email without throwing", async () => {
    const workerModule = await import("../../workers/email/index.js");
    const worker = workerModule.default;

    const raw = new Response("From: sender@example.com\nTo: recipient@example.com\n\nHello")
      .body;

    const message = {
      raw,
      from: "sender@example.com",
      to: "recipient@example.com",
      setReject: vi.fn(),
    };

    const waitUntilPromises = [];
    const ctx = {
      waitUntil: (promise) => {
        waitUntilPromises.push(promise);
      },
    };

    const testEnv = {
      ...env,
      DB: {},
      MAILSTORE: {},
      REALTIME_HUB: {
        idFromName: () => "global",
        get: () => ({
          fetch: async () => new Response("ok"),
        }),
      },
      TAG_LABELS: "Spam",
      OPENAI_API_KEY: "test",
      OPENAI_MODEL: "test",
    };

    await worker.email(message, testEnv, ctx);
    await Promise.all(waitUntilPromises);

    expect(message.setReject).not.toHaveBeenCalled();
  });
});
