import type { DurableBenchmarkEngineId } from './contracts';
import type { DurableBenchmarkHardGateDecision } from './hard-gates';
import {
  decideDurableBenchmark,
  type DurableBenchmarkDecision,
  type DurableBenchmarkScore,
} from './scoring';
import { PHASE_7_SCENARIO_VERSION } from './scenarios';

export interface Phase7BenchmarkEvidenceEngine {
  engineId: DurableBenchmarkEngineId;
  engineVersion?: string;
  hardGates: DurableBenchmarkHardGateDecision;
  score?: DurableBenchmarkScore;
  suiteCounts: Readonly<Record<string, number>>;
  realEvidence: boolean;
}

export interface Phase7BenchmarkEvidence {
  generatedAt: string;
  codeSha: string;
  scenarioVersion: string;
  engines: readonly Phase7BenchmarkEvidenceEngine[];
  decision: DurableBenchmarkDecision;
  reasons: readonly string[];
}

export interface BuildPhase7BenchmarkEvidenceInput {
  generatedAt: string;
  codeSha: string;
  prerequisiteSatisfied: boolean;
  engines: readonly Phase7BenchmarkEvidenceEngine[];
  reasons?: readonly string[];
}

const ENGINE_IDS: readonly DurableBenchmarkEngineId[] = ['current', 'inngest', 'vercel_workflow'];
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/i,
  /\b(?:api[_-]?key|token|secret|authorization)\s*[:=]\s*[^\s,;]+/i,
  /\bBearer\s+[A-Za-z0-9._~-]+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
const CUSTOMER_PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+\d[\d\s().-]{7,}\d)|(?:\b\d{3}[\s().-]\d{3}[\s.-]\d{3,4}\b)/,
];
const ORGANIZATION_PATTERN = /organization_id\s*[:=]\s*([A-Za-z0-9_-]+)/gi;

function assertFiniteNonNegativeCounts(counts: Readonly<Record<string, number>>): void {
  for (const [key, value] of Object.entries(counts)) {
    if (!key.trim() || !Number.isInteger(value) || value < 0) {
      throw new Error('invalid_benchmark_suite_count');
    }
  }
}

function assertEvidenceShape(evidence: Phase7BenchmarkEvidence): void {
  if (!Number.isFinite(Date.parse(evidence.generatedAt))) throw new Error('invalid_benchmark_generated_at');
  if (!/^[0-9a-f]{40}$/i.test(evidence.codeSha)) throw new Error('invalid_benchmark_code_sha');
  if (evidence.scenarioVersion !== PHASE_7_SCENARIO_VERSION) throw new Error('invalid_benchmark_scenario_version');

  const seen = new Set<DurableBenchmarkEngineId>();
  for (const engine of evidence.engines) {
    if (!ENGINE_IDS.includes(engine.engineId) || seen.has(engine.engineId)) {
      throw new Error('invalid_benchmark_engine_evidence');
    }
    seen.add(engine.engineId);
    assertFiniteNonNegativeCounts(engine.suiteCounts);
    if (engine.score && engine.score.engineId !== engine.engineId) {
      throw new Error('benchmark_score_engine_mismatch');
    }
  }
}

function assertSanitizedEvidence(serialized: string): void {
  for (const pattern of [...SECRET_PATTERNS, ...CUSTOMER_PII_PATTERNS]) {
    if (pattern.test(serialized)) throw new Error('unsafe_benchmark_evidence');
  }

  for (const match of serialized.matchAll(ORGANIZATION_PATTERN)) {
    const organizationId = match[1];
    if (organizationId && !organizationId.startsWith('bench-org-')) {
      throw new Error('unsafe_benchmark_evidence');
    }
  }
}

export function buildPhase7BenchmarkEvidence(
  input: BuildPhase7BenchmarkEvidenceInput,
): Phase7BenchmarkEvidence {
  const scores = input.engines.flatMap((engine) => (engine.score ? [engine.score] : []));
  const hardGatePass = Object.fromEntries(
    ENGINE_IDS.map((engineId) => [engineId, input.engines.find((engine) => engine.engineId === engineId)?.hardGates.passed ?? false]),
  ) as Record<DurableBenchmarkEngineId, boolean>;
  const realEvidence = Object.fromEntries(
    ENGINE_IDS.map((engineId) => [engineId, input.engines.find((engine) => engine.engineId === engineId)?.realEvidence ?? false]),
  ) as Record<DurableBenchmarkEngineId, boolean>;

  const reasons = [...(input.reasons ?? [])];
  let decision: DurableBenchmarkDecision;

  if (!input.prerequisiteSatisfied) {
    decision = 'INCOMPLETE';
    reasons.push('Agent OS real SHADOW/ASSISTED workload prerequisite is not satisfied.');
  } else if (input.engines.length !== ENGINE_IDS.length || scores.length !== ENGINE_IDS.length) {
    decision = 'INCOMPLETE';
    reasons.push('Comparative evidence is missing one or more benchmark engines or scores.');
  } else {
    decision = decideDurableBenchmark({ scores, hardGatePass, realEvidence });
  }

  const evidence: Phase7BenchmarkEvidence = {
    generatedAt: input.generatedAt,
    codeSha: input.codeSha,
    scenarioVersion: PHASE_7_SCENARIO_VERSION,
    engines: [...input.engines].sort((a, b) => ENGINE_IDS.indexOf(a.engineId) - ENGINE_IDS.indexOf(b.engineId)),
    decision,
    reasons,
  };

  assertEvidenceShape(evidence);
  return evidence;
}

export function serializePhase7BenchmarkEvidence(evidence: Phase7BenchmarkEvidence): string {
  assertEvidenceShape(evidence);
  const serialized = JSON.stringify(evidence, null, 2);
  assertSanitizedEvidence(serialized);
  return `${serialized}\n`;
}
