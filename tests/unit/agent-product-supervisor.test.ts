import { describe, expect, it } from "vitest";

import {
  PRODUCT_AGENT_IDS,
  isProductAgentId,
  validateSupervisorHandoffDecision,
} from "@/lib/agent-engine/product-agents/contracts";
import {
  SUPERVISOR_AGENT_DEFINITION,
  normalizeSupervisorHandoff,
} from "@/lib/agent-engine/product-agents/supervisor";

describe("Phase 3 product agent contracts", () => {
  it("defines exactly seven unique stable product roles", () => {
    expect(PRODUCT_AGENT_IDS).toEqual([
      "supervisor",
      "atendimento",
      "sales",
      "retention",
      "escalation",
      "crm_operator",
      "governance_judge",
    ]);
    expect(new Set(PRODUCT_AGENT_IDS).size).toBe(7);
  });

  it("fails closed for unknown product agent ids", () => {
    expect(isProductAgentId("sales")).toBe(true);
    expect(isProductAgentId("unknown_agent")).toBe(false);
  });

  it("accepts a bounded specialist handoff", () => {
    expect(
      validateSupervisorHandoffDecision({
        targetAgent: "atendimento",
        reason: "customer support request",
        confidence: 0.91,
        requiresHumanEscalation: false,
      }),
    ).toEqual({
      ok: true,
      value: {
        targetAgent: "atendimento",
        reason: "customer support request",
        confidence: 0.91,
        requiresHumanEscalation: false,
      },
    });
  });

  it("rejects supervisor self-routing and unknown targets", () => {
    expect(
      validateSupervisorHandoffDecision({
        targetAgent: "supervisor",
        reason: "loop",
        confidence: 0.5,
        requiresHumanEscalation: false,
      }),
    ).toEqual({ ok: false, reason: "invalid_target_agent" });

    expect(
      validateSupervisorHandoffDecision({
        targetAgent: "billing_bot",
        reason: "unknown",
        confidence: 0.5,
        requiresHumanEscalation: false,
      }),
    ).toEqual({ ok: false, reason: "invalid_target_agent" });
  });

  it("rejects non-finite or out-of-range confidence", () => {
    for (const confidence of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        validateSupervisorHandoffDecision({
          targetAgent: "escalation",
          reason: "uncertain",
          confidence,
          requiresHumanEscalation: true,
        }),
      ).toEqual({ ok: false, reason: "invalid_confidence" });
    }
  });

  it("requires a non-empty reason and explicit escalation boolean", () => {
    expect(
      validateSupervisorHandoffDecision({
        targetAgent: "sales",
        reason: "   ",
        confidence: 0.7,
        requiresHumanEscalation: false,
      }),
    ).toEqual({ ok: false, reason: "invalid_reason" });

    expect(
      validateSupervisorHandoffDecision({
        targetAgent: "sales",
        reason: "qualified lead",
        confidence: 0.7,
      }),
    ).toEqual({ ok: false, reason: "invalid_escalation_flag" });
  });
});

describe("Supervisor product definition", () => {
  it("is a versioned SHADOW role with no side-effect capability", () => {
    expect(SUPERVISOR_AGENT_DEFINITION.id).toBe("supervisor");
    expect(SUPERVISOR_AGENT_DEFINITION.version).toBe("1.0.0");
    expect(SUPERVISOR_AGENT_DEFINITION.autonomyLevel).toBe("shadow");
    expect(SUPERVISOR_AGENT_DEFINITION.allowedTools).toEqual([]);
    expect(SUPERVISOR_AGENT_DEFINITION.requiredModelCapabilities).toContain("structured_output");
  });

  it("has finite bounded loop budgets", () => {
    const loop = SUPERVISOR_AGENT_DEFINITION.loop;
    expect(loop.maxSteps).toBeGreaterThan(0);
    expect(loop.maxSteps).toBeLessThanOrEqual(6);
    expect(loop.maxToolCalls).toBe(1);
    expect(loop.maxTokens).toBeGreaterThan(0);
    expect(loop.maxCostCents).toBeGreaterThanOrEqual(0);
    expect(loop.maxRuntimeMs).toBeGreaterThan(0);
  });

  it("passes through a valid specialist handoff", () => {
    expect(
      normalizeSupervisorHandoff({
        targetAgent: "sales",
        reason: "lead asks for a proposal",
        confidence: 0.88,
        requiresHumanEscalation: false,
      }),
    ).toEqual({
      targetAgent: "sales",
      reason: "lead asks for a proposal",
      confidence: 0.88,
      requiresHumanEscalation: false,
    });
  });

  it("fails closed to human escalation for malformed or ambiguous output", () => {
    expect(normalizeSupervisorHandoff({ targetAgent: "unknown" })).toEqual({
      targetAgent: "escalation",
      reason: "supervisor_output_invalid",
      confidence: 0,
      requiresHumanEscalation: true,
    });

    expect(normalizeSupervisorHandoff(null)).toEqual({
      targetAgent: "escalation",
      reason: "supervisor_output_invalid",
      confidence: 0,
      requiresHumanEscalation: true,
    });
  });
});
