import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createInngestLocalDispatcher } from '../lib/agent-engine/durable-benchmark/adapters/inngest/local-dispatcher';
import { runPhase7InngestLocalCommand } from '../lib/agent-engine/durable-benchmark/adapters/inngest/local-command';
import type { DurableBenchmarkRunResult } from '../lib/agent-engine/durable-benchmark/contracts';
import { evaluateDurableBenchmarkHardGates } from '../lib/agent-engine/durable-benchmark/hard-gates';
import type { DurableBenchmarkProfile } from '../lib/agent-engine/durable-benchmark/runner';
import { PHASE_7_SCENARIO_VERSION } from '../lib/agent-engine/durable-benchmark/scenarios';

const INNGEST_BASE_URL = 'http://localhost:8288';
const NEXT_INNGEST_URL = 'http://localhost:3000/api/inngest';
const OUTPUT_PATH = path.join('docs', 'superpowers', 'verification', 'phase-7-inngest-local-evidence.json');
const PROFILES: readonly DurableBenchmarkProfile[] = ['small', 'medium', 'stress'];
const EXPECTED_COUNTS: Readonly<Record<DurableBenchmarkProfile, number>> = {
  small: 8,
  medium: 40,
  stress: 160,
};

async function assertReachable(url: string, label: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { method: 'GET' });
  } catch (error) {
    throw new Error(`${label}_unreachable:${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new Error(`${label}_unhealthy:http_${response.status}`);
}

function currentCodeSha(): string {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('phase7_inngest_invalid_code_sha');
  return sha;
}

function assertSanitized(serialized: string): void {
  const forbidden = [
    /\bBearer\s+[A-Za-z0-9._~-]+/i,
    /\bsk-[A-Za-z0-9_-]{8,}\b/i,
    /\b(?:authorization|api[_-]?key|token|secret)\s*[:=]\s*[^\s,;]+/i,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  ];
  if (forbidden.some((pattern) => pattern.test(serialized))) {
    throw new Error('unsafe_phase7_inngest_local_evidence');
  }
}

async function main(): Promise<void> {
  console.log('[phase7:inngest] preflight localhost:3000 + localhost:8288');
  await assertReachable(NEXT_INNGEST_URL, 'phase7_next_inngest_route');
  await assertReachable(INNGEST_BASE_URL, 'phase7_inngest_dev_server');

  const dispatcher = createInngestLocalDispatcher({
    baseUrl: INNGEST_BASE_URL,
    maxPolls: 480,
    pollIntervalMs: 250,
  });

  const suiteCounts: Record<DurableBenchmarkProfile, number> = {
    small: 0,
    medium: 0,
    stress: 0,
  };
  const runs: DurableBenchmarkRunResult[] = [];
  const profiles: Array<{
    profile: DurableBenchmarkProfile;
    generatedAtMs: number;
    runs: readonly DurableBenchmarkRunResult[];
  }> = [];

  for (const profile of PROFILES) {
    console.log(`[phase7:inngest] running ${profile} ...`);
    const report = await runPhase7InngestLocalCommand({ profile, dispatch: dispatcher });
    suiteCounts[profile] = report.runs.length;
    if (report.runs.length !== EXPECTED_COUNTS[profile]) {
      throw new Error(`phase7_inngest_unexpected_${profile}_count:${report.runs.length}`);
    }
    runs.push(...report.runs);
    profiles.push({ profile, generatedAtMs: report.generatedAtMs, runs: report.runs });
    console.log(`[phase7:inngest] ${profile}: ${report.runs.length}/${EXPECTED_COUNTS[profile]} collected`);
  }

  const hardGates = evaluateDurableBenchmarkHardGates(runs);
  const engineVersions = [...new Set(runs.flatMap((run) => (run.engineVersion ? [run.engineVersion] : [])))];
  const evidence = {
    generatedAt: new Date().toISOString(),
    codeSha: currentCodeSha(),
    engineId: 'inngest' as const,
    engineVersions,
    scenarioVersion: PHASE_7_SCENARIO_VERSION,
    providerExecution: 'real_local_dev_server' as const,
    syntheticOnly: true,
    suiteCounts,
    totalRuns: runs.length,
    hardGates,
    profiles,
  };

  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  assertSanitized(serialized);
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, serialized, 'utf8');

  console.log(`[phase7:inngest] total: ${runs.length}/208 collected`);
  console.log(`[phase7:inngest] hard gates: ${hardGates.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[phase7:inngest] evidence: ${OUTPUT_PATH}`);

  if (!hardGates.passed) {
    for (const failure of hardGates.failures.slice(0, 20)) {
      console.error(`[phase7:inngest] ${failure.gate} ${failure.runId}: ${failure.evidence}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[phase7:inngest] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
