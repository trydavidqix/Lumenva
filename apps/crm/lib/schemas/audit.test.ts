import { describe, expect, it } from "vitest";

import { auditQuerySchema, decodeAuditCursor, encodeAuditCursor } from "./audit";

const cursor = {
  created_at: "2026-09-10T12:34:56.789Z",
  id: "11111111-1111-4111-8111-111111111111",
};

describe("audit filters and pagination contract", () => {
  it("accepts the documented filters and defaults limit to 50", () => {
    expect(
      auditQuerySchema.parse({
        actor_id: "22222222-2222-4222-8222-222222222222",
        action: "lead.moved",
        resource_type: "lead",
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-10T23:59:59.999Z",
      }),
    ).toMatchObject({ actor_id: "22222222-2222-4222-8222-222222222222", limit: 50 });
  });

  it("rejects limits above the API maximum", () => {
    expect(() => auditQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it("round-trips an opaque keyset cursor", () => {
    expect(decodeAuditCursor(encodeAuditCursor(cursor))).toEqual(cursor);
  });

  it.each([
    "not-base64",
    Buffer.from("not-a-timestamp|11111111-1111-4111-8111-111111111111").toString("base64url"),
    Buffer.from("2026-09-10T12:34:56.789Z|not-a-uuid").toString("base64url"),
    Buffer.from("2026-09-10T12:34:56.789Z|11111111-1111-4111-8111-111111111111|extra").toString(
      "base64url",
    ),
  ])("rejects malformed cursor %s", (raw) => {
    expect(decodeAuditCursor(raw)).toBeNull();
  });
});
