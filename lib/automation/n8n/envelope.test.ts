import { describe, it, expect } from "vitest";
import { buildN8nEnvelope, type N8nIntegrationEnvelope } from "./envelope";

describe("n8n Integration Envelope", () => {
  const baseInput = {
    eventId: "evt_abc123",
    eventType: "contact.created",
    occurredAt: "2026-08-16T10:30:00Z",
    organizationId: "org_550e8400e29b41d4a716446655440000",
    idempotencyKey: "idem_key_stable",
    data: {
      contactId: "contact_123",
      name: "Test User",
    },
  };

  describe("basic envelope structure", () => {
    it("should transform camelCase input to snake_case output", () => {
      const envelope = buildN8nEnvelope(baseInput);

      expect(envelope).toHaveProperty("event_id");
      expect(envelope).toHaveProperty("event_type");
      expect(envelope).toHaveProperty("occurred_at");
      expect(envelope).toHaveProperty("organization_ref");
      expect(envelope).toHaveProperty("idempotency_key");
      expect(envelope).toHaveProperty("data");
    });

    it("should preserve event metadata values", () => {
      const envelope = buildN8nEnvelope(baseInput);

      expect(envelope.event_id).toBe("evt_abc123");
      expect(envelope.event_type).toBe("contact.created");
      expect(envelope.occurred_at).toBe("2026-08-16T10:30:00Z");
    });

    it("should preserve the idempotency key unchanged", () => {
      const envelope = buildN8nEnvelope(baseInput);

      expect(envelope.idempotency_key).toBe("idem_key_stable");
    });

    it("should produce consistent output for the same input", () => {
      const envelope1 = buildN8nEnvelope(baseInput);
      const envelope2 = buildN8nEnvelope(baseInput);

      expect(envelope1).toEqual(envelope2);
      expect(envelope1.idempotency_key).toBe(envelope2.idempotency_key);
      expect(envelope1.organization_ref).toBe(envelope2.organization_ref);
    });
  });

  describe("organization_ref", () => {
    it("should create opaque deterministic reference from organizationId", () => {
      const envelope = buildN8nEnvelope(baseInput);

      expect(envelope.organization_ref).toBeDefined();
      expect(typeof envelope.organization_ref).toBe("string");
    });

    it("should be 32 characters (truncated SHA256 hex)", () => {
      const envelope = buildN8nEnvelope(baseInput);

      expect(envelope.organization_ref).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should be different for different organizations", () => {
      const envelope1 = buildN8nEnvelope({
        ...baseInput,
        organizationId: "org_550e8400e29b41d4a716446655440000",
      });
      const envelope2 = buildN8nEnvelope({
        ...baseInput,
        organizationId: "org_aabbccddee11223344556677aabbccdd",
      });

      expect(envelope1.organization_ref).not.toBe(envelope2.organization_ref);
    });

    it("should not contain the raw UUID", () => {
      const envelope = buildN8nEnvelope(baseInput);

      expect(envelope.organization_ref).not.toContain("550e8400e29b41d4a716446655440000");
    });

    it("should not contain the string 'org_'", () => {
      const envelope = buildN8nEnvelope(baseInput);

      expect(envelope.organization_ref).not.toContain("org_");
    });

    it("should survive retries with same organizationId", () => {
      const envelope1 = buildN8nEnvelope(baseInput);
      const envelope2 = buildN8nEnvelope(baseInput);

      expect(envelope1.organization_ref).toBe(envelope2.organization_ref);
    });
  });

  describe("data sanitization", () => {
    it("should pass through safe data fields", () => {
      const safeData = {
        contactId: "contact_123",
        name: "Test User",
        email: "test@example.com",
        phone: "+55 (11) 9 9999-9999",
        status: "active",
        tags: ["important", "vip"],
      };

      const envelope = buildN8nEnvelope({
        ...baseInput,
        data: safeData,
      });

      expect(envelope.data).toEqual(safeData);
    });

    it("should reject API key assignments", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            config: "api_key = ***REMOVED***",
          },
        }),
      ).toThrow("api_key");
    });

    it("should reject API key like values (sk_ prefixed)", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            token: "***REMOVED***",
          },
        }),
      ).toThrow("api_key");
    });

    it("should reject bearer credentials", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            auth: "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
          },
        }),
      ).toThrow("credential");
    });

    it("should reject JWT-like values", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payloadpart123456.signatureparthere",
          },
        }),
      ).toThrow("credential");
    });

    it("should reject session/cookie assignments", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            session: "session_id = abc123xyz789",
          },
        }),
      ).toThrow("session_or_credential");
    });

    it("should reject password statements", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            config: "password = SecurePass123!",
          },
        }),
      ).toThrow("password_or_recovery_code");
    });

    it("should reject recovery code statements", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            recovery: "recovery code ABCD-EFGH-IJKL",
          },
        }),
      ).toThrow("password_or_recovery_code");
    });

    it("should reject CVV/card security codes", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            payment: "cvv = 123",
          },
        }),
      ).toThrow("payment_card");
    });

    it("should reject card numbers", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            card: "4532 1234 5678 9010",
          },
        }),
      ).toThrow("payment_card");
    });

    it("should reject CPF (Brazilian tax ID)", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            cpf: "123.456.789-10",
          },
        }),
      ).toThrow("cpf");
    });

    it("should reject internal secret variable names", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            env: "DATABASE_PASSWORD=mySecretPassword123",
          },
        }),
      ).toThrow("internal_secret_variable");
    });

    it("should reject AWS access key IDs", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            aws: "***REMOVED***",
          },
        }),
      ).toThrow("api_key");
    });

    it("should reject GitHub PAT tokens", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            github: "***REMOVED***",
          },
        }),
      ).toThrow("api_key");
    });

    it("should scan nested object values", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            nested: {
              config: "api_key = sk_test_12345",
            },
          },
        }),
      ).toThrow("api_key");
    });

    it("should scan array element values", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            items: ["safe_value", "api_key = sk_test_12345"],
          },
        }),
      ).toThrow("api_key");
    });

    it("should scan deeply nested values", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          data: {
            level1: {
              level2: {
                level3: "api_key = sk_test_12345",
              },
            },
          },
        }),
      ).toThrow("api_key");
    });
  });

  describe("validation", () => {
    it("should reject empty eventId", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          eventId: "",
        }),
      ).toThrow("eventId");
    });

    it("should reject empty eventType", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          eventType: "",
        }),
      ).toThrow("eventType");
    });

    it("should reject empty idempotencyKey", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          idempotencyKey: "",
        }),
      ).toThrow("idempotencyKey");
    });

    it("should reject empty organizationId", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          organizationId: "",
        }),
      ).toThrow("organizationId");
    });

    it("should reject empty occurredAt (M7 fix: was silently allowed, now fails closed like the other required fields)", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          occurredAt: "",
        }),
      ).toThrow("occurredAt");
    });

    it("should reject non-string occurredAt", () => {
      expect(() =>
        buildN8nEnvelope({
          ...baseInput,
          // @ts-expect-error deliberately passing a non-string to prove the runtime guard
          occurredAt: null,
        }),
      ).toThrow("occurredAt");
    });
  });

  describe("complete integration", () => {
    it("should build valid envelope matching the interface", () => {
      const envelope = buildN8nEnvelope(baseInput);

      const expected: N8nIntegrationEnvelope = {
        event_id: "evt_abc123",
        event_type: "contact.created",
        occurred_at: "2026-08-16T10:30:00Z",
        organization_ref: envelope.organization_ref, // We don't know the exact value
        idempotency_key: "idem_key_stable",
        data: {
          contactId: "contact_123",
          name: "Test User",
        },
      };

      expect(envelope).toEqual(expected);
    });

    it("should handle complex real-world data", () => {
      const complexData = {
        eventId: "evt_contact_created_20260816",
        contactId: "contact_abc123def456",
        organizationId: "org_xyz789mno012",
        userData: {
          firstName: "João",
          lastName: "Silva",
          email: "joao.silva@example.com",
          phoneCountryCode: "+55",
          phoneAreaCode: "21",
          phoneNumber: "98765432",
        },
        metadata: {
          source: "whatsapp",
          timestamp: "2026-08-16T10:30:00Z",
          tags: ["vip", "premium"],
        },
      };

      const envelope = buildN8nEnvelope({
        eventId: "evt_contact_created_20260816",
        eventType: "contact.created",
        occurredAt: "2026-08-16T10:30:00Z",
        organizationId: "org_550e8400e29b41d4a716446655440000",
        idempotencyKey: "idem_contact_created_20260816",
        data: complexData,
      });

      expect(envelope).toBeDefined();
      expect(envelope.data).toEqual(complexData);
    });
  });

  describe("error messages", () => {
    it("should provide clear error when secret is found", () => {
      try {
        buildN8nEnvelope({
          ...baseInput,
          data: {
            secret: "api_key = sk_test_12345",
          },
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Secret/credential detected");
      }
    });
  });
});
