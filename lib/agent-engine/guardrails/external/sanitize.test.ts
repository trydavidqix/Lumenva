import { describe, it, expect } from "vitest";
import {
  sanitizeExternalGuardrailCandidate,
  type ExternalGuardrailCandidate,
} from "./sanitize";

const baseCandidate: ExternalGuardrailCandidate = {
  organizationId: "5c1f0e2a-9e3b-4a4a-8b9a-3d1c6f2a9b10",
  direction: "input",
  text: "Can you check my order status?",
  policy: "standard",
};

describe("sanitizeExternalGuardrailCandidate", () => {
  it("allows clean text and returns exactly the four request fields", () => {
    const result = sanitizeExternalGuardrailCandidate(baseCandidate);

    expect(result).toEqual({
      allowed: true,
      request: {
        organizationId: baseCandidate.organizationId,
        direction: "input",
        text: baseCandidate.text,
        policy: "standard",
      },
    });
  });

  describe("secret detection (reused from sanitizeMemoryCandidate)", () => {
    it("blocks bearer tokens", () => {
      const result = sanitizeExternalGuardrailCandidate({
        ...baseCandidate,
        text: "Authorization: Bearer abcdef1234567890",
      });

      expect(result.allowed).toBe(false);
    });

    it("blocks cookie/session assignments", () => {
      const result = sanitizeExternalGuardrailCandidate({
        ...baseCandidate,
        text: "set-cookie: session=abc123xyz",
      });

      expect(result.allowed).toBe(false);
    });

    it("blocks API keys", () => {
      const result = sanitizeExternalGuardrailCandidate({
        ...baseCandidate,
        text: "api key is sk-abcdefghijklmno1234567890",
      });

      expect(result.allowed).toBe(false);
    });

    it("blocks passwords", () => {
      const result = sanitizeExternalGuardrailCandidate({
        ...baseCandidate,
        text: "my password is hunter2fallback",
      });

      expect(result.allowed).toBe(false);
    });

    it("applies the same rules to output-direction candidates, not just input", () => {
      const result = sanitizeExternalGuardrailCandidate({
        ...baseCandidate,
        direction: "output",
        text: "Sure, your API key is sk-liveabcdefghijklmno1234",
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe("tenant id isolation", () => {
    it("rejects text that interpolates the organization id", () => {
      const result = sanitizeExternalGuardrailCandidate({
        ...baseCandidate,
        text: `Message from org ${baseCandidate.organizationId}: hello`,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "organization_id_in_text",
      });
    });

    it("keeps organizationId as separate structured metadata, never inside text", () => {
      const result = sanitizeExternalGuardrailCandidate(baseCandidate);

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.request.text).not.toContain(baseCandidate.organizationId);
        expect(result.request.organizationId).toBe(baseCandidate.organizationId);
      }
    });
  });

  describe("output-content metadata stripping", () => {
    it("drops caller metadata from the sanitized request for output validation", () => {
      const result = sanitizeExternalGuardrailCandidate({
        organizationId: baseCandidate.organizationId,
        direction: "output",
        text: "Seu pedido foi enviado.",
        policy: "standard",
        metadata: {
          leadId: "lead-999",
          contactId: "contact-123",
          contactEmail: "cliente@example.com",
          contactPhone: "+351912345678",
          conversationId: "conv-42",
        },
      });

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.request).toEqual({
          organizationId: baseCandidate.organizationId,
          direction: "output",
          text: "Seu pedido foi enviado.",
          policy: "standard",
        });
        expect(Object.keys(result.request)).not.toContain("metadata");
      }
    });

    it("never folds metadata values into the validated text, even when metadata carries PII", () => {
      const result = sanitizeExternalGuardrailCandidate({
        organizationId: baseCandidate.organizationId,
        direction: "output",
        text: "Confirmado.",
        policy: "standard",
        metadata: { contactEmail: "cliente@example.com" },
      });

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.request.text).not.toContain("cliente@example.com");
      }
    });
  });
});
