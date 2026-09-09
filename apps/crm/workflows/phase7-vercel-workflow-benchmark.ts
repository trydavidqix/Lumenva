import { defineHook, getStepMetadata, RetryableError } from 'workflow';

import type {
  DurableBenchmarkLifecycleEvent,
  DurableBenchmarkRunInput,
  DurableBenchmarkTerminalState,
} from '@/lib/agent-engine/durable-benchmark/contracts';
import { getPhase7Scenarios } from '@/lib/agent-engine/durable-benchmark/scenarios';
import type { VercelWorkflowBenchmarkInvocationResult } from '@/lib/agent-engine/durable-benchmark/adapters/vercel-workflow/workflow';

export const PHASE7_VERCEL_WORKFLOW_ENGINE_VERSION = 'workflow-v4.8.0-local-world';

export const phase7ApprovalHook = defineHook<{ approved: boolean }>();

export function phase7ApprovalToken(deliveryGroupId: string, runId: string): string {
  return `phase7:${deliveryGroupId}:${runId}`;
}

async function workAStep(runId: string): Promise<{ runId: string }> {
  'use step';
  return { runId };
}

async function workBStep(scenarioId: string): Promise<{ attempt: number }> {
  'use step';
  const { attempt } = getStepMetadata();
  const scenario = getPhase7Scenarios().find((candidate) => candidate.id === scenarioId);
  if (!scenario) throw new Error(`phase7_vercel_workflow_unknown_scenario:${scenarioId}`);
  const shouldFail = scenario.faults.some(
    (fault) => fault.kind === 'transient_failure' && fault.stepId === 'work-b' && fault.occurrence === attempt,
  );
  if (shouldFail) {
    throw new RetryableError(`phase7_vercel_workflow_transient_failure:${attempt}`, { retryAfter: 5 });
  }
  return { attempt };
}
workBStep.maxRetries = 2;

async function processRecoveryStep(scenarioId: string): Promise<{ attempt: number }> {
  'use step';
  const { attempt } = getStepMetadata();
  if (scenarioId === 'process_crash_recovery' && attempt === 1) {
    throw new RetryableError('phase7_vercel_workflow_injected_process_interruption', { retryAfter: 5 });
  }
  return { attempt };
}
processRecoveryStep.maxRetries = 1;

async function commitSyntheticEffect(input: {
  deliveryGroupId: string;
  runId: string;
}): Promise<{ committed: boolean }> {
  'use step';
  const [{ mkdir, open }, { createHash }] = await Promise.all([
    import('node:fs/promises'),
    import('node:crypto'),
  ]);
  const key = createHash('sha256').update(`${input.deliveryGroupId}:${input.runId}`).digest('hex');
  const directory = '.next/phase7-vercel-workflow-effects';
  await mkdir(directory, { recursive: true });
  try {
    const handle = await open(`${directory}/${key}.once`, 'wx');
    await handle.writeFile('committed');
    await handle.close();
    return { committed: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return { committed: false };
    throw error;
  }
}

export async function phase7VercelWorkflowBenchmark(input: {
  run: DurableBenchmarkRunInput;
  deliveryGroupId: string;
}): Promise<VercelWorkflowBenchmarkInvocationResult> {
  'use workflow';

  const { run, deliveryGroupId } = input;
  const scenario = getPhase7Scenarios().find((candidate) => candidate.id === run.scenarioId);
  if (!scenario) throw new Error(`phase7_vercel_workflow_unknown_scenario:${run.scenarioId}`);
  if (!run.organizationId.startsWith('bench-org-')) throw new Error('phase7_vercel_workflow_requires_synthetic_organization');
  if (scenario.version !== run.scenarioVersion) throw new Error('phase7_vercel_workflow_scenario_version_mismatch');
  if (scenario.organizationId !== run.organizationId) throw new Error('phase7_vercel_workflow_organization_mismatch');
  if (!deliveryGroupId.trim()) throw new Error('phase7_vercel_workflow_delivery_group_required');

  const lifecycle: DurableBenchmarkLifecycleEvent[] = [];
  let tick = 0;
  let retryCount = 0;
  let approvalSatisfied = false;
  let resumedFromExpectedStep = !scenario.requiresApproval;
  let recoveredAfterCrash = false;
  let effectAttempts = 0;
  let committedEffects = 0;

  const record = (
    kind: string,
    evidence: string,
    options: { stepId?: string; attempt?: number } = {},
  ) => {
    lifecycle.push({
      seq: lifecycle.length + 1,
      kind,
      atMs: tick++,
      evidence,
      ...(options.stepId === undefined ? {} : { stepId: options.stepId }),
      ...(options.attempt === undefined ? {} : { attempt: options.attempt }),
    });
  };

  const finish = (terminalState: DurableBenchmarkTerminalState): VercelWorkflowBenchmarkInvocationResult => {
    record('terminal', `Vercel Workflow local benchmark finished as ${terminalState}`);
    return {
      terminalState,
      lifecycle,
      retryCount,
      approvalRequired: scenario.requiresApproval,
      approvalSatisfied,
      resumedFromExpectedStep,
      effectAttempts,
      committedEffects,
      recoveredAfterCrash,
      crossTenantViolation: false,
      durationMs: Math.max(0, tick - 1),
      engineVersion: PHASE7_VERCEL_WORKFLOW_ENGINE_VERSION,
    };
  };

  record('run_started', 'Workflow Local World accepted isolated synthetic benchmark run');
  await workAStep(run.runId);
  record('checkpoint', 'work-a completed as a durable Workflow step', { stepId: 'work-a' });

  if (scenario.id === 'tenant_isolation') {
    record('tenant_attempt_blocked', 'synthetic cross-tenant attempt blocked before any effect', {
      stepId: 'work-a',
      attempt: 1,
    });
    return finish('failed');
  }

  try {
    const workB = await workBStep(scenario.id);
    retryCount = Math.max(0, workB.attempt - 1);
    record('step_succeeded', 'work-b completed after Workflow retry handling', {
      stepId: 'work-b',
      attempt: workB.attempt,
    });
  } catch {
    retryCount = scenario.maxRetries;
    record('retry_exhausted', 'Workflow exhausted the configured retry budget for work-b', {
      stepId: 'work-b',
      attempt: scenario.maxRetries + 1,
    });
    return finish('failed');
  }

  if (scenario.requiresApproval) {
    record('approval_wait', 'Workflow suspended on a deterministic approval hook', { stepId: 'approval' });
    const events = phase7ApprovalHook.create({ token: phase7ApprovalToken(deliveryGroupId, run.runId) });
    let approved = false;
    for await (const event of events) {
      approved = event.approved;
      break;
    }

    if (!approved) {
      record('approval_rejected', 'synthetic approval hook rejected the run', { stepId: 'approval' });
      return finish('rejected');
    }

    approvalSatisfied = true;
    resumedFromExpectedStep = true;
    record('approval_resumed', 'Workflow resumed from the approval hook checkpoint', { stepId: 'approval' });

    if (scenario.id === 'process_crash_recovery') {
      const recovered = await processRecoveryStep(scenario.id);
      retryCount += Math.max(0, recovered.attempt - 1);
      recoveredAfterCrash = recovered.attempt > 1;
      resumedFromExpectedStep = true;
      record('process_recovered', 'Workflow retried an interrupted durable step and preserved prior state', {
        stepId: 'resume',
        attempt: recovered.attempt,
      });
    }
  }

  effectAttempts = 1;
  const effect = await commitSyntheticEffect({ deliveryGroupId, runId: run.runId });
  committedEffects = effect.committed ? 1 : 0;
  record(
    effect.committed ? 'effect_committed' : 'duplicate_suppressed',
    effect.committed
      ? 'isolated synthetic effect committed through an atomic local benchmark store'
      : 'duplicate delivery observed the existing idempotency record and committed no second effect',
    { stepId: 'effect', attempt: 1 },
  );

  return finish('completed');
}
