import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createInngestLocalDispatcher } from '../lib/agent-engine/durable-benchmark/adapters/inngest/local-dispatcher';
import { createVercelWorkflowLocalDispatcher } from '../lib/agent-engine/durable-benchmark/adapters/vercel-workflow/local-dispatcher';
import { runPhase7ComparativeBenchmarkOrchestrator } from '../lib/agent-engine/durable-benchmark/comparative-orchestrator';
import { serializePhase7BenchmarkEvidence } from '../lib/agent-engine/durable-benchmark/evidence';
import { runCurrentPhase7Provider } from '../lib/agent-engine/durable-benchmark/providers/current-provider';
import { runInngestPhase7Provider } from '../lib/agent-engine/durable-benchmark/providers/inngest-provider';
import { runVercelWorkflowPhase7Provider } from '../lib/agent-engine/durable-benchmark/providers/vercel-workflow-provider';
import type { Phase7ProviderReport } from '../lib/agent-engine/durable-benchmark/provider-report';

const OUTPUT_DIR = path.join('docs', 'superpowers', 'verification');
const EVIDENCE_PATH = path.join(OUTPUT_DIR, 'phase-7-comparative-benchmark-evidence.json');
const SUMMARY_PATH = path.join(OUTPUT_DIR, 'phase-7-comparative-benchmark-summary.md');
const INNGEST_BASE_URL = 'http://localhost:8288';
const NEXT_INNGEST_URL = 'http://localhost:3000/api/inngest';
const VERCEL_WORKFLOW_LOCAL_URL = 'http://localhost:3000/api/phase7/vercel-workflow';

function currentCodeSha(): string {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('phase7_invalid_code_sha');
  return sha;
}

async function reachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

function providerLine(provider: Phase7ProviderReport): string {
  const total = provider.suiteCounts.small + provider.suiteCounts.medium + provider.suiteCounts.stress;
  if (provider.status === 'BLOCKED') return `- ${provider.engineId}: BLOCKED — ${provider.reason ?? 'provider_blocked'}`;
  return `- ${provider.engineId}: ${provider.status} — ${total}/208 runs; hard gates ${provider.hardGates.passed ? 'PASS' : 'FAIL'}`;
}

async function main(): Promise<void> {
  const codeSha = currentCodeSha();
  const generatedAt = new Date().toISOString();

  console.log('[phase7:all] current ...');
  const current = () => runCurrentPhase7Provider();

  console.log('[phase7:all] inngest preflight ...');
  const nextReady = await reachable(NEXT_INNGEST_URL);
  const inngestReady = await reachable(INNGEST_BASE_URL);
  const inngest = nextReady && inngestReady
    ? () => runInngestPhase7Provider({
        dispatch: createInngestLocalDispatcher({
          baseUrl: INNGEST_BASE_URL,
          maxPolls: 480,
          pollIntervalMs: 250,
        }),
      })
    : () => runInngestPhase7Provider({ blocker: !nextReady ? 'next_inngest_route_unreachable' : 'inngest_dev_server_unreachable' });

  console.log('[phase7:all] vercel_workflow preflight ...');
  const vercelWorkflowReady = await reachable(VERCEL_WORKFLOW_LOCAL_URL);
  const vercelWorkflowDispatch = createVercelWorkflowLocalDispatcher({
    baseUrl: 'http://localhost:3000',
    maxPolls: 600,
    pollIntervalMs: 100,
  });
  const vercelWorkflow = vercelWorkflowReady
    ? () => runVercelWorkflowPhase7Provider({
        realRuntime: true,
        invoke: async ({ run }) => vercelWorkflowDispatch(run),
      })
    : () => runVercelWorkflowPhase7Provider({});

  const result = await runPhase7ComparativeBenchmarkOrchestrator({
    current,
    inngest,
    vercelWorkflow,
    generatedAt,
    codeSha,
    prerequisiteSatisfied: true,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(EVIDENCE_PATH, serializePhase7BenchmarkEvidence(result.evidence), 'utf8');

  const summary = [
    '# Phase 7 Comparative Benchmark Summary',
    '',
    `- Generated at: ${generatedAt}`,
    `- Code SHA: ${codeSha}`,
    `- Decision: ${result.evidence.decision}`,
    '',
    '## Providers',
    '',
    ...result.providers.map(providerLine),
    '',
    '## Reasons',
    '',
    ...(result.evidence.reasons.length > 0 ? result.evidence.reasons.map((reason) => `- ${reason}`) : ['- none']),
    '',
  ].join('\n');
  await writeFile(SUMMARY_PATH, summary, 'utf8');

  for (const provider of result.providers) console.log(`[phase7:all] ${providerLine(provider).slice(2)}`);
  console.log(`[phase7:all] decision: ${result.evidence.decision}`);
  console.log(`[phase7:all] evidence: ${EVIDENCE_PATH}`);
  console.log(`[phase7:all] summary: ${SUMMARY_PATH}`);

  if (result.evidence.decision === 'INCOMPLETE' || result.evidence.decision === 'NO_GO') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[phase7:all] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
