import type { DurableBenchmarkAdapter, DurableBenchmarkEngineId } from './contracts';
import {
  buildPhase7BenchmarkEvidence,
  type Phase7BenchmarkEvidence,
  type Phase7BenchmarkEvidenceEngine,
} from './evidence';
import { evaluateDurableBenchmarkHardGates } from './hard-gates';
import { createDurableBenchmarkRunner, type DurableBenchmarkProfile } from './runner';
import { scoreDurableBenchmark } from './scoring';

export * from './contracts';
export * from './effect-store';
export * from './evidence';
export * from './fault-plan';
export * from './hard-gates';
export * from './provider-report';
export * from './comparative-orchestrator';
export * from './providers/current-provider';
export * from './providers/inngest-provider';
export * from './providers/vercel-workflow-provider';
export * from './runner';
export * from './scenarios';
export * from './scoring';
export * from './adapters/current';
export * from './adapters/inngest/adapter';
export * from './adapters/inngest/functions';
export * from './adapters/vercel-workflow/adapter';
export * from './adapters/vercel-workflow/workflow';

export const PHASE_7_PROFILE_REPETITIONS: Readonly<Record<DurableBenchmarkProfile, number>> = {
  small: 3,
  medium: 5,
  stress: 3,
};

const ENGINE_IDS: readonly DurableBenchmarkEngineId[] = ['current', 'inngest', 'vercel_workflow'];
const PROFILES: readonly DurableBenchmarkProfile[] = ['small', 'medium', 'stress'];

type ScoreDimensions = Parameters<typeof scoreDurableBenchmark>[1];

export async function runPhase7ComparativeBenchmark(input: {
  adapters: ReadonlyMap<DurableBenchmarkEngineId, DurableBenchmarkAdapter>;
  scoreDimensions: Readonly<Partial<Record<DurableBenchmarkEngineId, ScoreDimensions>>>;
  realEvidence: Readonly<Partial<Record<DurableBenchmarkEngineId, boolean>>>;
  prerequisiteSatisfied: boolean;
  generatedAt: string;
  codeSha: string;
  reasons?: readonly string[];
}): Promise<Phase7BenchmarkEvidence> {
  const runner = createDurableBenchmarkRunner({ adapters: input.adapters });
  const engines: Phase7BenchmarkEvidenceEngine[] = [];
  const reasons = [...(input.reasons ?? [])];

  for (const engineId of ENGINE_IDS) {
    const adapter = input.adapters.get(engineId);
    const dimensions = input.scoreDimensions[engineId];
    if (!adapter || !dimensions) {
      reasons.push(`Missing executable adapter or scoring rubric for ${engineId}.`);
      continue;
    }

    const allResults = [];
    const suiteCounts: Record<string, number> = {};
    for (const profile of PROFILES) {
      const repetitions = PHASE_7_PROFILE_REPETITIONS[profile];
      const suite = await runner.runSuite({ engineId, profile, repetitions });
      suiteCounts[profile] = suite.results.length;
      allResults.push(...suite.results);
    }

    engines.push({
      engineId,
      engineVersion: allResults.find((result) => result.engineVersion)?.engineVersion,
      hardGates: evaluateDurableBenchmarkHardGates(allResults),
      score: scoreDurableBenchmark(engineId, dimensions),
      suiteCounts,
      realEvidence: input.realEvidence[engineId] === true,
    });
  }

  return buildPhase7BenchmarkEvidence({
    generatedAt: input.generatedAt,
    codeSha: input.codeSha,
    prerequisiteSatisfied: input.prerequisiteSatisfied,
    engines,
    reasons,
  });
}
