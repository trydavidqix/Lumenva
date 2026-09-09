import type { DurableBenchmarkEngineId, DurableBenchmarkRunResult } from './contracts';
import { evaluateDurableBenchmarkHardGates, type DurableBenchmarkHardGateDecision } from './hard-gates';
import { scoreDurableBenchmark, type DurableBenchmarkScore } from './scoring';

export const PHASE_7_PROFILE_COUNTS = {
  small: 8,
  medium: 40,
  stress: 160,
} as const;

export type Phase7ProviderStatus = 'PASS' | 'FAIL' | 'BLOCKED';
export type Phase7ScoreDimensions = Parameters<typeof scoreDurableBenchmark>[1];

export interface Phase7ProviderReport {
  engineId: DurableBenchmarkEngineId;
  engineVersion?: string;
  status: Phase7ProviderStatus;
  realEvidence: boolean;
  suiteCounts: Readonly<Record<'small' | 'medium' | 'stress', number>>;
  runs: readonly DurableBenchmarkRunResult[];
  hardGates: DurableBenchmarkHardGateDecision;
  score?: DurableBenchmarkScore;
  reason?: string;
}

function assertCanonicalCounts(counts: Readonly<Record<'small' | 'medium' | 'stress', number>>): void {
  for (const profile of ['small', 'medium', 'stress'] as const) {
    if (counts[profile] !== PHASE_7_PROFILE_COUNTS[profile]) {
      throw new Error(`phase7_provider_suite_count_mismatch:${profile}:${counts[profile]}`);
    }
  }
}

function sanitizeReason(reason: string): string {
  const normalized = reason.trim().replace(/[^A-Za-z0-9_.:-]+/g, '_').slice(0, 160);
  return normalized || 'provider_blocked';
}

export function buildPhase7ProviderReport(input: {
  engineId: DurableBenchmarkEngineId;
  runs: readonly DurableBenchmarkRunResult[];
  suiteCounts: Readonly<Record<'small' | 'medium' | 'stress', number>>;
  realEvidence: boolean;
  scoreDimensions?: Phase7ScoreDimensions;
}): Phase7ProviderReport {
  assertCanonicalCounts(input.suiteCounts);
  if (input.runs.length !== 208) throw new Error(`phase7_provider_run_count_mismatch:${input.runs.length}`);
  if (input.runs.some((run) => run.engineId !== input.engineId)) throw new Error('phase7_provider_engine_mismatch');

  const hardGates = evaluateDurableBenchmarkHardGates(input.runs);
  const score = input.scoreDimensions ? scoreDurableBenchmark(input.engineId, input.scoreDimensions) : undefined;
  const engineVersion = input.runs.find((run) => run.engineVersion)?.engineVersion;

  return {
    engineId: input.engineId,
    ...(engineVersion ? { engineVersion } : {}),
    status: hardGates.passed ? 'PASS' : 'FAIL',
    realEvidence: input.realEvidence,
    suiteCounts: { ...input.suiteCounts },
    runs: [...input.runs],
    hardGates,
    ...(score ? { score } : {}),
  };
}

export function blockedPhase7ProviderReport(input: {
  engineId: DurableBenchmarkEngineId;
  reason: string;
}): Phase7ProviderReport {
  return {
    engineId: input.engineId,
    status: 'BLOCKED',
    realEvidence: false,
    suiteCounts: { small: 0, medium: 0, stress: 0 },
    runs: [],
    hardGates: { passed: false, failures: [] },
    reason: sanitizeReason(input.reason),
  };
}
