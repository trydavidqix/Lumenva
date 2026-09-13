import { describe, expect, it } from "vitest";

import { assertScenarioTransition, canTransitionScenario, isTerminalScenarioStatus } from "./state-machine";

describe("Scenario Lab state machine", () => {
  it("accepts the canonical happy path", () => {
    expect(canTransitionScenario("DRAFT", "EVIDENCE_READY")).toBe(true);
    expect(canTransitionScenario("EVIDENCE_READY", "COMPILED")).toBe(true);
    expect(canTransitionScenario("COMPILED", "READY")).toBe(true);
    expect(canTransitionScenario("READY", "RUNNING")).toBe(true);
    expect(canTransitionScenario("RUNNING", "ANALYZING")).toBe(true);
    expect(canTransitionScenario("ANALYZING", "COMPLETED")).toBe(true);
  });

  it("does not allow skipping governance gates", () => {
    expect(canTransitionScenario("DRAFT", "RUNNING")).toBe(false);
    expect(canTransitionScenario("READY", "COMPLETED")).toBe(false);
    expect(() => assertScenarioTransition("DRAFT", "RUNNING")).toThrow(/invalid scenario transition/i);
  });

  it("treats terminal states as immutable", () => {
    for (const status of ["COMPLETED", "CANCELLED", "FAILED", "EXPIRED"] as const) {
      expect(isTerminalScenarioStatus(status)).toBe(true);
      expect(canTransitionScenario(status, "DRAFT")).toBe(false);
      expect(canTransitionScenario(status, status)).toBe(false);
    }
  });

  it("allows cancellation/failure from active lifecycle states", () => {
    for (const status of ["DRAFT", "EVIDENCE_READY", "COMPILED", "READY", "RUNNING", "ANALYZING"] as const) {
      expect(canTransitionScenario(status, "CANCELLED")).toBe(true);
      expect(canTransitionScenario(status, "FAILED")).toBe(true);
    }
  });
});
