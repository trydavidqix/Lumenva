import type { ScenarioStatus } from "../contracts/scenario";

const terminalStatuses = new Set<ScenarioStatus>(["COMPLETED", "CANCELLED", "FAILED", "EXPIRED"]);

const canonicalTransitions: Record<ScenarioStatus, ReadonlySet<ScenarioStatus>> = {
  DRAFT: new Set(["EVIDENCE_READY", "CANCELLED", "FAILED", "EXPIRED"]),
  EVIDENCE_READY: new Set(["COMPILED", "CANCELLED", "FAILED", "EXPIRED"]),
  COMPILED: new Set(["READY", "CANCELLED", "FAILED", "EXPIRED"]),
  READY: new Set(["RUNNING", "CANCELLED", "FAILED", "EXPIRED"]),
  RUNNING: new Set(["ANALYZING", "CANCELLED", "FAILED", "EXPIRED"]),
  ANALYZING: new Set(["COMPLETED", "CANCELLED", "FAILED", "EXPIRED"]),
  COMPLETED: new Set(),
  CANCELLED: new Set(),
  FAILED: new Set(),
  EXPIRED: new Set(),
};

export function isTerminalScenarioStatus(status: ScenarioStatus): boolean {
  return terminalStatuses.has(status);
}

export function canTransitionScenario(from: ScenarioStatus, to: ScenarioStatus): boolean {
  if (from === to || isTerminalScenarioStatus(from)) return false;
  return canonicalTransitions[from].has(to);
}

export function assertScenarioTransition(from: ScenarioStatus, to: ScenarioStatus): void {
  if (!canTransitionScenario(from, to)) {
    throw new Error(`Invalid scenario transition: ${from} -> ${to}`);
  }
}

export function allowedScenarioTransitions(from: ScenarioStatus): ScenarioStatus[] {
  return [...canonicalTransitions[from]];
}
