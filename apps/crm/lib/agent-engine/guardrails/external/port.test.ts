import { describe, it, expect, vi } from "vitest";
import {
  ExternalGuardrailRequest,
  ExternalGuardrailResult,
  NoopExternalGuardrailPort,
} from "./port";

describe("ExternalGuardrailPort types", () => {
  describe("ExternalGuardrailRequest", () => {
    it("should have required fields", () => {
      const request: ExternalGuardrailRequest = {
        organizationId: "org-123",
        direction: "input",
        text: "Hello world",
        policy: "standard",
      };

      expect(request.organizationId).toBeDefined();
      expect(request.direction).toBeDefined();
      expect(request.text).toBeDefined();
      expect(request.policy).toBeDefined();
    });

    it("should allow output direction", () => {
      const request: ExternalGuardrailRequest = {
        organizationId: "org-123",
        direction: "output",
        text: "Response text",
        policy: "standard",
      };

      expect(request.direction).toBe("output");
    });
  });

  describe("ExternalGuardrailResult", () => {
    it("should have required fields with correct types", () => {
      const result: ExternalGuardrailResult = {
        passed: true,
        code: "pass",
        severity: "advisory",
        latencyMs: 1.5,
      };

      expect(typeof result.passed).toBe("boolean");
      expect(typeof result.code).toBe("string");
      expect(result.severity).toBe("advisory");
      expect(typeof result.latencyMs).toBe("number");
    });

    it("should allow blocking severity", () => {
      const result: ExternalGuardrailResult = {
        passed: false,
        code: "policy_violation",
        severity: "blocking",
        latencyMs: 2.0,
      };

      expect(result.severity).toBe("blocking");
      expect(result.passed).toBe(false);
    });

    it("should allow optional sanitizedText", () => {
      const result: ExternalGuardrailResult = {
        passed: true,
        code: "pass",
        severity: "advisory",
        sanitizedText: "cleaned text",
        latencyMs: 1.0,
      };

      expect(result.sanitizedText).toBe("cleaned text");
    });
  });
});

describe("NoopExternalGuardrailPort", () => {
  let port: NoopExternalGuardrailPort;

  it("should instantiate", () => {
    port = new NoopExternalGuardrailPort();
    expect(port).toBeDefined();
  });

  it("should always return passed: true", async () => {
    port = new NoopExternalGuardrailPort();

    const request: ExternalGuardrailRequest = {
      organizationId: "org-123",
      direction: "input",
      text: "Any input text",
      policy: "standard",
    };

    const result = await port.validate(request);

    expect(result.passed).toBe(true);
  });

  it("should return code: pass", async () => {
    port = new NoopExternalGuardrailPort();

    const request: ExternalGuardrailRequest = {
      organizationId: "org-456",
      direction: "output",
      text: "Output text",
      policy: "custom",
    };

    const result = await port.validate(request);

    expect(result.code).toBe("pass");
  });

  it("should return severity: advisory", async () => {
    port = new NoopExternalGuardrailPort();

    const request: ExternalGuardrailRequest = {
      organizationId: "org-789",
      direction: "input",
      text: "Test text",
      policy: "standard",
    };

    const result = await port.validate(request);

    expect(result.severity).toBe("advisory");
  });

  it("should preserve input text in sanitizedText", async () => {
    port = new NoopExternalGuardrailPort();

    const inputText = "Original text content";
    const request: ExternalGuardrailRequest = {
      organizationId: "org-123",
      direction: "input",
      text: inputText,
      policy: "standard",
    };

    const result = await port.validate(request);

    expect(result.sanitizedText).toBe(inputText);
  });

  it("should measure latency in milliseconds", async () => {
    port = new NoopExternalGuardrailPort();

    const request: ExternalGuardrailRequest = {
      organizationId: "org-123",
      direction: "input",
      text: "Test",
      policy: "standard",
    };

    const result = await port.validate(request);

    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.latencyMs).toBeLessThan(100); // Should be nearly instant
  });

  it("should return consistent structure across calls", async () => {
    port = new NoopExternalGuardrailPort();

    const request1: ExternalGuardrailRequest = {
      organizationId: "org-1",
      direction: "input",
      text: "Text 1",
      policy: "policy1",
    };

    const request2: ExternalGuardrailRequest = {
      organizationId: "org-2",
      direction: "output",
      text: "Text 2",
      policy: "policy2",
    };

    const result1 = await port.validate(request1);
    const result2 = await port.validate(request2);

    expect(result1.passed).toBe(true);
    expect(result2.passed).toBe(true);
    expect(result1.code).toBe(result2.code);
    expect(result1.severity).toBe(result2.severity);
  });

  it("should not make network calls", async () => {
    port = new NoopExternalGuardrailPort();

    // Track global fetch/http calls if any were made
    const fetchSpy = vi.spyOn(global, "fetch");

    const request: ExternalGuardrailRequest = {
      organizationId: "org-123",
      direction: "input",
      text: "Test text",
      policy: "standard",
    };

    await port.validate(request);

    // Should not have called fetch
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should handle empty text", async () => {
    port = new NoopExternalGuardrailPort();

    const request: ExternalGuardrailRequest = {
      organizationId: "org-123",
      direction: "input",
      text: "",
      policy: "standard",
    };

    const result = await port.validate(request);

    expect(result.passed).toBe(true);
    expect(result.sanitizedText).toBe("");
  });

  it("should handle large text", async () => {
    port = new NoopExternalGuardrailPort();

    const largeText = "x".repeat(10000);
    const request: ExternalGuardrailRequest = {
      organizationId: "org-123",
      direction: "input",
      text: largeText,
      policy: "standard",
    };

    const result = await port.validate(request);

    expect(result.passed).toBe(true);
    expect(result.sanitizedText).toBe(largeText);
  });

  it("should handle special characters", async () => {
    port = new NoopExternalGuardrailPort();

    const specialText = 'Hello "world" with \n newlines and \t tabs and émojis 🎉';
    const request: ExternalGuardrailRequest = {
      organizationId: "org-123",
      direction: "input",
      text: specialText,
      policy: "standard",
    };

    const result = await port.validate(request);

    expect(result.passed).toBe(true);
    expect(result.sanitizedText).toBe(specialText);
  });
});
