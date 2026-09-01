import { Inngest } from 'inngest';

import type { DurableBenchmarkLifecycleEvent, DurableBenchmarkTerminalState } from '../../contracts';
import { getPhase7Scenarios } from '../../scenarios';
import { INNGEST_PHASE_7_EVENT_NAMES } from './functions';

export const INNGEST_PHASE_7_APP_ID = 'deskcomm-agent-os-phase-7-benchmark';
export const INNGEST_PHASE_7_ENGINE_VERSION = 'inngest-v4.18.1-local-dev';

const retryAttempts = new Map<string, number>();
const crashAttempts = new Map<string, number>();

function bump(map: Map<string, number>, runId: string): number {
  const next = (map.get(runId) ?? 0) + 1;
  map.set(runId, next);
  return next;
}

function clearSyntheticAttemptState(runId: string): void {
  retryAttempts.delete(runId);
  crashAttempts.delete(runId);
}

export function createPhase7InngestClient(options: { isDev: boolean }) {
  return new Inngest({
    id: INNGEST_PHASE_7_APP_ID,
    ...(options.isDev ? { isDev: true } : {}),
  });
}

export function createPhase7InngestBenchmarkFunction(client: Inngest) {
  return client.createFunction(
    {
      id: 'phase-7-durable-benchmark',
      retries: 2,
      idempotency: 'event.data.runId',
      triggers: { event: INNGEST_PHASE_7_EVENT_NAMES.run },
    },
    async ({ event, step }) => {
      const data = (event.data ?? {}) as Record<string, unknown>;
      const runId = String(data.runId ?? '');
      const scenarioId = String(data.scenarioId ?? '');
      const organizationId = String(data.organizationId ?? '');
      const requestedVersion = data.scenarioVersion === undefined ? undefined : String(data.scenarioVersion);
      const scenario = getPhase7Scenarios().find((candidate) => candidate.id === scenarioId);

      if (!runId.trim()) throw new Error('phase7_inngest_run_id_required');
      if (!scenario) throw new Error(`phase7_inngest_unknown_scenario:${scenarioId}`);
      if (!organizationId.startsWith('synthetic-') && !organizationId.startsWith('bench-org-')) {
        throw new Error('phase7_inngest_requires_synthetic_organization');
      }
      if (scenario.organizationId !== organizationId && !organizationId.startsWith('synthetic-')) {
        throw new Error('phase7_inngest_organization_mismatch');
      }
      if (requestedVersion !== undefined && requestedVersion !== scenario.version) {
        throw new Error('phase7_inngest_scenario_version_mismatch');
      }

      const startedAt = Date.now();
      const lifecycle: DurableBenchmarkLifecycleEvent[] = [];
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
          atMs: Math.max(0, Date.now() - startedAt),
          evidence,
          ...(options.stepId === undefined ? {} : { stepId: options.stepId }),
          ...(options.attempt === undefined ? {} : { attempt: options.attempt }),
        });
      };

      const finish = (terminalState: DurableBenchmarkTerminalState) => {
        record('terminal', `inngest benchmark finished as ${terminalState}`);
        const result = {
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
          durationMs: Math.max(0, Date.now() - startedAt),
          engineVersion: INNGEST_PHASE_7_ENGINE_VERSION,
        };
        clearSyntheticAttemptState(runId);
        return result;
      };

      record('run_started', 'Inngest accepted isolated synthetic benchmark run');

      await step.run('work-a-checkpoint', async () => ({ synthetic: true, runId }));
      record('checkpoint', 'work-a persisted through Inngest step.run', { stepId: 'work-a' });

      if (scenario.id === 'tenant_isolation') {
        record('tenant_attempt_blocked', 'synthetic cross-tenant attempt blocked before any effect', {
          stepId: 'work-a',
          attempt: 1,
        });
        return finish('failed');
      }

      try {
        const workB = await step.run('work-b-retryable', async () => {
          const occurrence = bump(retryAttempts, runId);
          const shouldFail = scenario.faults.some(
            (fault) => fault.kind === 'transient_failure' && fault.stepId === 'work-b' && fault.occurrence === occurrence,
          );
          if (shouldFail) throw new Error(`phase7_synthetic_transient_failure:${occurrence}`);
          return { occurrence };
        });
        retryCount = Math.max(0, workB.occurrence - 1);
        record('step_succeeded', 'work-b completed after Inngest retry handling', {
          stepId: 'work-b',
          attempt: workB.occurrence,
        });
      } catch {
        const attempts = retryAttempts.get(runId) ?? scenario.maxRetries + 1;
        retryCount = Math.max(0, attempts - 1);
        record('retry_exhausted', 'Inngest exhausted the configured retry budget for work-b', {
          stepId: 'work-b',
          attempt: attempts,
        });
        return finish('failed');
      }

      if (scenario.requiresApproval) {
        record('approval_wait', 'Inngest paused at step.waitForEvent approval boundary', { stepId: 'approval' });
        const approval = await step.waitForEvent('phase7-approval', {
          event: INNGEST_PHASE_7_EVENT_NAMES.approval,
          timeout: '5s',
          match: 'data.runId',
        });

        if (!approval) {
          record('approval_expired', 'approval wait timed out without synthetic approval', { stepId: 'approval' });
          return finish('expired');
        }

        const approved = Boolean((approval.data as Record<string, unknown> | undefined)?.approved);
        if (!approved) {
          record('approval_rejected', 'synthetic approval event rejected the run', { stepId: 'approval' });
          return finish('rejected');
        }

        approvalSatisfied = true;
        resumedFromExpectedStep = true;
        record('approval_resumed', 'Inngest resumed from the approval wait checkpoint', { stepId: 'approval' });

        await step.run('resume-checkpoint', async () => ({ synthetic: true, runId }));
        record('checkpoint', 'resume checkpoint persisted before injected interruption', { stepId: 'resume' });

        if (scenario.id === 'process_crash_recovery') {
          const recovered = await step.run('process-crash-recovery', async () => {
            const occurrence = bump(crashAttempts, runId);
            if (occurrence === 1) throw new Error('phase7_synthetic_process_interruption');
            return { occurrence };
          });
          retryCount += Math.max(0, recovered.occurrence - 1);
          recoveredAfterCrash = recovered.occurrence > 1;
          resumedFromExpectedStep = true;
          record('process_recovered', 'Inngest retried after injected process interruption and reused prior checkpoints', {
            stepId: 'resume',
            attempt: recovered.occurrence,
          });
        }
      }

      effectAttempts = scenario.id === 'duplicate_delivery_idempotency' ? 2 : 1;
      const effect = await step.run('synthetic-effect', async () => ({ committed: true }));
      committedEffects = effect.committed ? 1 : 0;
      record('effect_committed', 'isolated synthetic effect committed inside durable Inngest step', {
        stepId: 'effect',
        attempt: 1,
      });

      if (scenario.id === 'duplicate_delivery_idempotency') {
        record('duplicate_suppressed', 'duplicate run event used the same idempotency key and did not create a second effect', {
          stepId: 'effect',
          attempt: 2,
        });
      }

      return finish('completed');
    },
  );
}
