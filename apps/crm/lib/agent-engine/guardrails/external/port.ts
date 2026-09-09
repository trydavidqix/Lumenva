/**
 * External guardrail port — contract-only interface for forward-compatible
 * validation layer. The noop adapter always passes; future implementations
 * may route requests to a deterministic or external validator.
 */

export interface ExternalGuardrailRequest {
  organizationId: string;
  direction: "input" | "output";
  text: string;
  policy: string;
}

export interface ExternalGuardrailResult {
  passed: boolean;
  code: string;
  severity: "advisory" | "blocking";
  sanitizedText?: string;
  latencyMs: number;
}

export interface ExternalGuardrailPort {
  validate(input: ExternalGuardrailRequest): Promise<ExternalGuardrailResult>;
}

/**
 * NoopExternalGuardrailPort — always passes, never makes network calls.
 * Safe default for forward compatibility.
 */
export class NoopExternalGuardrailPort implements ExternalGuardrailPort {
  async validate(input: ExternalGuardrailRequest): Promise<ExternalGuardrailResult> {
    const start = performance.now();

    // No-op: always passes, preserves text unchanged
    const latencyMs = performance.now() - start;

    return {
      passed: true,
      code: "pass",
      severity: "advisory",
      sanitizedText: input.text,
      latencyMs: Math.round(latencyMs * 100) / 100,
    };
  }
}
