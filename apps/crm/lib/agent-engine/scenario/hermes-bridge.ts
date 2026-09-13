export interface ScenarioLearningCandidate {
  lifecycle: "CANDIDATE";
  source: "scenario_lab";
  organizationId: string;
  scenarioId: string;
  reportId: string;
  runIds: string[];
  evidenceRefs: string[];
  finding: string;
  confidence: number | null;
  createdAt: string;
}

export interface LearningCandidateSink {
  publish(candidate: ScenarioLearningCandidate): Promise<{ id: string }>;
}

export interface CreateScenarioLearningCandidateInput {
  organizationId: string;
  scenarioId: string;
  reportId: string;
  runIds: string[];
  evidenceRefs: string[];
  finding: string;
  confidence: number | null;
  now?: string;
}

export async function createHermesLearningCandidate(
  sink: LearningCandidateSink,
  input: CreateScenarioLearningCandidateInput,
): Promise<{ id: string }> {
  if (!input.organizationId.trim() || !input.scenarioId.trim() || !input.reportId.trim()) {
    throw new Error("Hermes candidate requires organization, scenario and report provenance.");
  }
  if (!input.finding.trim()) throw new Error("Hermes candidate finding is required.");
  if (input.confidence !== null && (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1)) {
    throw new Error("Hermes candidate confidence must be between 0 and 1 when provided.");
  }

  return sink.publish({
    lifecycle: "CANDIDATE",
    source: "scenario_lab",
    organizationId: input.organizationId,
    scenarioId: input.scenarioId,
    reportId: input.reportId,
    runIds: [...new Set(input.runIds)],
    evidenceRefs: [...new Set(input.evidenceRefs)],
    finding: input.finding.trim(),
    confidence: input.confidence,
    createdAt: input.now ?? new Date().toISOString(),
  });
}
