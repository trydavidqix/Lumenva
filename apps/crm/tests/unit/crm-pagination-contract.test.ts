import { afterEach, describe, expect, it, vi } from "vitest";

import { decodeLeadCursor, encodeLeadCursor } from "@/app/api/v1/leads/_handler";

describe("CRM pagination cursors", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("signs lead cursors and rejects tampering", () => {
    vi.stubEnv("CURSOR_HMAC_SECRET", "test-only-cursor-secret");
    const cursor = encodeLeadCursor({
      created_at: "2026-09-15T00:00:00.000Z",
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(cursor.split(".")).toHaveLength(2);
    expect(decodeLeadCursor(cursor)).toEqual({
      created_at: "2026-09-15T00:00:00.000Z",
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(decodeLeadCursor(`${cursor}tampered`)).toBeNull();
  });

  it("does not silently create unsigned cursors when the signing key is absent", () => {
    vi.stubEnv("CURSOR_HMAC_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => encodeLeadCursor({ created_at: "2026-09-15T00:00:00.000Z", id: "lead" })).toThrow(
      "CURSOR_HMAC_SECRET is required",
    );
  });
});
