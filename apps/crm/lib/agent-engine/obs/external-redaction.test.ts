import { describe, expect, it } from "vitest";

import { opaqueTenantId, sanitizeExternalTraceValue } from "./external-redaction";

describe("sanitizeExternalTraceValue", () => {
  it("removes credentials from sensitive keys at every nesting level", () => {
    const result = sanitizeExternalTraceValue({
      Authorization: "Bearer credential-that-must-not-leave-the-process",
      headers: {
        cookie: "session=top-secret",
        "set-cookie": "refresh=also-secret",
        api_key: "provider-key",
        apiKey: "provider-key-without-underscore",
        access_token: "access-token",
        clientSecret: "client-secret",
        password: "password",
      },
      attempts: [{ bearer: "Bearer nested-credential" }],
    });

    expect(result).toEqual({
      Authorization: "[REDACTED]",
      headers: {
        cookie: "[REDACTED]",
        "set-cookie": "[REDACTED]",
        api_key: "[REDACTED]",
        apiKey: "[REDACTED]",
        access_token: "[REDACTED]",
        clientSecret: "[REDACTED]",
        password: "[REDACTED]",
      },
      attempts: [{ bearer: "[REDACTED]" }],
    });
  });

  it("redacts bearer credentials and JWT-like values embedded in readable text", () => {
    const result = sanitizeExternalTraceValue(
      "Request used Bearer abcdefghijklmnopqrstuvwxyz and eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.signature",
    );

    expect(result).toBe("Request used Bearer [REDACTED] and [JWT]");
  });

  it("masks e-mail addresses and phone numbers without obscuring ordinary product text", () => {
    const result = sanitizeExternalTraceValue({
      message: "Onboarding completed for alice@example.test. Call +1 (415) 555-2671 tomorrow.",
      label: "Agent handoff completed successfully",
    });

    expect(result).toEqual({
      message: "Onboarding completed for [EMAIL]. Call [PHONE] tomorrow.",
      label: "Agent handoff completed successfully",
    });
  });

  it("sanitizes arrays and nested objects recursively", () => {
    const result = sanitizeExternalTraceValue({
      events: [
        { message: "customer@example.test requested a demo" },
        { metadata: { token: "do-not-export" } },
      ],
    });

    expect(result).toEqual({
      events: [
        { message: "[EMAIL] requested a demo" },
        { metadata: { token: "[REDACTED]" } },
      ],
    });
  });

  it("does not throw or retain cycles and unserializable values", () => {
    const circular: Record<string, unknown> = {
      count: 1n,
      callback: () => "not trace data",
      symbol: Symbol("not trace data"),
    };
    circular.self = circular;

    const result = sanitizeExternalTraceValue(circular);

    expect(result).toEqual({
      count: "[UNSERIALIZABLE]",
      callback: "[UNSERIALIZABLE]",
      symbol: "[UNSERIALIZABLE]",
      self: "[CIRCULAR]",
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("caps oversized strings and collections before they leave the process", () => {
    const result = sanitizeExternalTraceValue({
      text: "a".repeat(3_000),
      events: Array.from({ length: 101 }, () => "safe event"),
    }) as { text: string; events: unknown[] };

    expect(result.text).toBe("[TRUNCATED]");
    expect(result.events).toHaveLength(101);
    expect(result.events.at(-1)).toBe("[TRUNCATED]");
  });

  it("drops oversized text rather than exposing a partial identifier at the cap boundary", () => {
    const result = sanitizeExternalTraceValue(`${"a".repeat(1_990)} alice@example.test`);

    expect(result).toBe("[TRUNCATED]");
  });
});

describe("opaqueTenantId", () => {
  it("returns a deterministic non-reversible tenant label", () => {
    const organizationId = "00000000-0000-4000-8000-000000000001";

    const first = opaqueTenantId(organizationId);
    const second = opaqueTenantId(organizationId);

    expect(first).toBe(second);
    expect(first).toMatch(/^tenant_[a-f0-9]{16}$/);
    expect(first).not.toContain(organizationId);
  });
});
