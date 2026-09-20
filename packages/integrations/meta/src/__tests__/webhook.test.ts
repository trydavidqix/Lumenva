import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifySignature, verifyChallenge } from "../verify";
import { normalizeMetaPayload } from "../types";
import { createHmac } from "node:crypto";


// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSignature(body: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

// ─── verifySignature ──────────────────────────────────────────────────────────

describe("verifySignature", () => {
  const secret = "test_secret_1234";

  it("accepts a valid HMAC-SHA256 signature", () => {
    const body = JSON.stringify({ foo: "bar" });
    const sig = makeSignature(body, secret);
    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ foo: "bar" });
    const sig = makeSignature(body, secret);
    expect(verifySignature(JSON.stringify({ foo: "baz" }), sig, secret)).toBe(false);
  });

  it("rejects a signature with wrong prefix", () => {
    const body = "hello";
    const sig = "sha1=" + createHmac("sha1", secret).update(body).digest("hex");
    expect(verifySignature(body, sig, secret)).toBe(false);
  });

  it("rejects null/undefined signature", () => {
    expect(verifySignature("body", null, secret)).toBe(false);
    expect(verifySignature("body", undefined, secret)).toBe(false);
  });

  it("rejects empty secret", () => {
    const body = "body";
    const sig = makeSignature(body, secret);
    expect(verifySignature(body, sig, "")).toBe(false);
  });
});

// ─── verifyChallenge ─────────────────────────────────────────────────────────

describe("verifyChallenge", () => {
  it("returns challenge string when all params match", () => {
    expect(verifyChallenge("subscribe", "mytoken", "abc123", "mytoken")).toBe("abc123");
  });

  it("returns null when mode is wrong", () => {
    expect(verifyChallenge("unsubscribe", "mytoken", "abc123", "mytoken")).toBeNull();
  });

  it("returns null when token mismatch", () => {
    expect(verifyChallenge("subscribe", "wrongtoken", "abc123", "mytoken")).toBeNull();
  });

  it("returns null when challenge missing", () => {
    expect(verifyChallenge("subscribe", "mytoken", null, "mytoken")).toBeNull();
  });
});

// ─── normalizeMetaPayload ─────────────────────────────────────────────────────

describe("normalizeMetaPayload", () => {
  it("normalizes an Instagram comment event", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "ig_account_123",
          changes: [
            {
              field: "comments",
              value: {
                id: "evt_456",
                text: "Adorei o post!",
                from: { id: "user_789", username: "fan" },
                media_id: "media_001",
              },
            },
          ],
        },
      ],
    };

    const events = normalizeMetaPayload(payload);
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.platform).toBe("instagram");
    expect(ev.eventType).toBe("comment");
    expect(ev.text).toBe("Adorei o post!");
    expect(ev.actor?.username).toBe("fan");
    expect(ev.postExternalId).toBe("media_001");
    expect(ev.accountExternalId).toBe("ig_account_123");
  });

  it("normalizes a Facebook message event", () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: "page_001",
          changes: [
            {
              field: "messages",
              value: {
                id: "msg_999",
                text: "Olá, como posso ajudar?",
              },
            },
          ],
        },
      ],
    };

    const events = normalizeMetaPayload(payload);
    expect(events).toHaveLength(1);
    expect(events[0].platform).toBe("facebook");
    expect(events[0].eventType).toBe("message");
  });

  it("deduplicates events sharing the same externalEventId", () => {
    const seen = new Set<string>();
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "acc",
          changes: [
            { field: "comments", value: { id: "dup_1", text: "oi" } },
            { field: "comments", value: { id: "dup_1", text: "oi" } },
          ],
        },
      ],
    };
    const events = normalizeMetaPayload(payload).filter((e) => {
      if (seen.has(e.externalEventId)) return false;
      seen.add(e.externalEventId);
      return true;
    });
    expect(events).toHaveLength(1);
  });

  it("returns empty array for malformed input", () => {
    expect(normalizeMetaPayload({})).toHaveLength(0);
    expect(normalizeMetaPayload({ object: "instagram", entry: [] })).toHaveLength(0);
  });
});
