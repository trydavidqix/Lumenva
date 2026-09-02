import { createCurrentDurableBenchmarkAdapter } from '@/lib/agent-engine/durable-benchmark/adapters/current';
import { createInMemoryBenchmarkEffectStore } from '@/lib/agent-engine/durable-benchmark/effect-store';
import {
  runPhase7ComparativeBenchmark,
  serializePhase7BenchmarkEvidence,
} from '@/lib/agent-engine/durable-benchmark';

async function main(): Promise<void> {
  if (process.env.PHASE7_BENCHMARK_ENABLE !== 'true') {
    throw new Error('phase7_benchmark_disabled');
  }

  const codeSha = process.env.PHASE7_BENCHMARK_CODE_SHA?.trim();
  if (!codeSha || !/^[0-9a-f]{40}$/i.test(codeSha)) {
    throw new Error('phase7_benchmark_requires_exact_code_sha');
  }

  const effectStore = createInMemoryBenchmarkEffectStore();
  const current = createCurrentDurableBenchmarkAdapter({ effectStore });

  const evidence = await runPhase7ComparativeBenchmark({
    adapters: new Map([['current', current]]),
    scoreDimensions: {
      current: {
        reliability: 0,
        durability: 0,
        observability: 0,
        operationalSimplicity: 0,
        performance: 0,
        cost: 0,
        maintainability: 0,
      },
    },
    realEvidence: { current: false },
    prerequisiteSatisfied: false,
    generatedAt: new Date().toISOString(),
    codeSha,
    reasons: [
      'CLI is wired only to the isolated current-engine synthetic adapter by default.',
      'External Inngest and Vercel Workflow evidence must come from real approved provider runtimes; mocks never satisfy realEvidence.',
      'Zero score dimensions in this default CLI path are placeholders and are not an adoption score.',
    ],
  });

  process.stdout.write(serializePhase7BenchmarkEvidence(evidence));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
