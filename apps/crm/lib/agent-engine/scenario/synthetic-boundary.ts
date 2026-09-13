import type { SyntheticArtifactProvenance } from "../contracts/scenario";

const syntheticTargets = new Set([
  "scenario_run_events",
  "scenario_agent_actions",
  "scenario_outcomes",
  "scenario_metrics",
  "scenario_comparisons",
  "scenario_reports",
  "scenario_backtests",
  "scenario_calibration",
]);

export function isScenarioSyntheticWriteTarget(target: string): boolean {
  return syntheticTargets.has(target);
}

export function assertSyntheticWriteTarget(target: string): void {
  if (!isScenarioSyntheticWriteTarget(target)) {
    throw new Error(`Invalid synthetic write target: ${target}. Synthetic data cannot mutate authoritative CRM state.`);
  }
}

export function assertSyntheticArtifact(
  artifact: Omit<SyntheticArtifactProvenance, "createdAt" | "modelVersion" | "evidenceRefs"> &
    Partial<Pick<SyntheticArtifactProvenance, "createdAt" | "modelVersion" | "evidenceRefs">>,
): asserts artifact is SyntheticArtifactProvenance {
  if (artifact.synthetic !== true) {
    throw new Error("Scenario simulation artifacts must declare synthetic=true.");
  }
  if (!artifact.scenarioId?.trim() || !artifact.runId?.trim()) {
    throw new Error("Scenario provenance requires non-empty scenario and run identifiers.");
  }
  if (!Number.isSafeInteger(artifact.seed)) {
    throw new Error("Scenario provenance requires an integer simulation seed.");
  }
  if (!artifact.engineVersion?.trim()) {
    throw new Error("Scenario provenance requires an engine version.");
  }
}
