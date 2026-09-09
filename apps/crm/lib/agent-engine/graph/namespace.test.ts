import { describe, expect, it } from "vitest";

import { graphGroupId } from "./namespace";

describe("graphGroupId", () => {
  describe("Valid UUIDs", () => {
    it("accepts a canonical UUID v4 and returns a scoped namespace", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = graphGroupId(validUuid);

      expect(result).toBe(`org:${validUuid}`);
    });

    it("accepts valid UUIDs of any version (Zod uuid() validator is version-agnostic)", () => {
      // Zod's uuid() validator accepts any well-formed UUID, regardless of version.
      // Since organizationId comes from Supabase (guaranteed to be valid UUID),
      // we accept all valid UUID formats.
      const uuidV1 = "550e8400-e29b-11d4-a716-446655440000"; // time-based
      const uuidV3 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // MD5 namespace
      const uuidV5 = "886313e1-3b8a-5372-9b90-0c9aee199e5d"; // SHA1 namespace

      expect(() => graphGroupId(uuidV1)).not.toThrow();
      expect(() => graphGroupId(uuidV3)).not.toThrow();
      expect(() => graphGroupId(uuidV5)).not.toThrow();
    });

    it("returns deterministic output for the same UUID", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const first = graphGroupId(uuid);
      const second = graphGroupId(uuid);

      expect(first).toBe(second);
    });

    it("produces different namespaces for different organizations (no collisions)", () => {
      const orgA = "550e8400-e29b-41d4-a716-446655440001";
      const orgB = "550e8400-e29b-41d4-a716-446655440002";

      const namespaceA = graphGroupId(orgA);
      const namespaceB = graphGroupId(orgB);

      // Different orgs must never produce the same namespace.
      expect(namespaceA).not.toBe(namespaceB);

      // Both must follow the expected format.
      expect(namespaceA).toBe(`org:${orgA}`);
      expect(namespaceB).toBe(`org:${orgB}`);
    });

    it("embeds only the UUID, not human-readable identifiers", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = graphGroupId(uuid);

      // Verify that the namespace contains only the org prefix and the UUID.
      expect(result).toMatch(/^org:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Explicitly confirm no common PII patterns are present.
      expect(result).not.toMatch(/email/i);
      expect(result).not.toMatch(/name/i);
      expect(result).not.toMatch(/phone/i);
      expect(result).not.toMatch(/cpf/i);
      expect(result).not.toMatch(/contact/i);
      expect(result).not.toMatch(/user/i);
    });
  });

  describe("Malformed UUIDs", () => {
    it.each([
      ["empty string", ""],
      ["random text", "not-a-uuid"],
      ["missing hyphens", "550e8400e29b41d4a716446655440000"],
      ["extra characters", "550e8400-e29b-41d4-a716-446655440000-"],
      ["numeric string", "12345678901234567890"],
      ["partial UUID", "550e8400-e29b-41d4"],
      ["with prefix", "uuid-550e8400-e29b-41d4-a716-446655440000"],
      ["spaces", "550e8400-e29b-41d4-a716-446655440000 "],
      ["with curly braces", "{550e8400-e29b-41d4-a716-446655440000}"],
    ])("rejects malformed UUID: %s", (_case, malformedUuid) => {
      expect(() => graphGroupId(malformedUuid)).toThrow();
    });
  });

  describe("Tenant isolation", () => {
    it("ensures organizations A and B with different UUIDs never share a namespace", () => {
      const orgA = "550e8400-e29b-41d4-a716-000000000001";
      const orgB = "550e8400-e29b-41d4-a716-000000000002";
      const orgC = "6ba7b811-9dad-41d4-a716-000000000003";

      const nsA = graphGroupId(orgA);
      const nsB = graphGroupId(orgB);
      const nsC = graphGroupId(orgC);

      // All must be unique.
      const namespaces = new Set([nsA, nsB, nsC]);
      expect(namespaces.size).toBe(3);

      // None should collide.
      expect(nsA).not.toBe(nsB);
      expect(nsB).not.toBe(nsC);
      expect(nsA).not.toBe(nsC);
    });

    it("preserves the organization UUID in the namespace for identity purposes", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      const result = graphGroupId(uuid);

      // The UUID itself must be preserved in the namespace for graph adapter identity.
      expect(result).toContain(uuid);
    });
  });

  describe("Edge cases and invariants", () => {
    it("handles multiple valid v4 UUIDs deterministically in a loop", () => {
      const uuids = [
        "550e8400-e29b-41d4-a716-446655440000",
        "6ba7b811-9dad-41d4-a716-446655440001",
        "123e4567-e89b-12d3-a456-426614174000",
      ];

      const results = uuids.map((uuid) => graphGroupId(uuid));
      const resultsAgain = uuids.map((uuid) => graphGroupId(uuid));

      // All results must match their re-execution (determinism).
      expect(results).toEqual(resultsAgain);

      // All results must be unique (no false collisions).
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(uuids.length);
    });

    it("rejects null or undefined (type safety at runtime)", () => {
      expect(() => graphGroupId(null as unknown as string)).toThrow();
      expect(() => graphGroupId(undefined as unknown as string)).toThrow();
    });
  });
});
