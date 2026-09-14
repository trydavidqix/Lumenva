import { deriveToolIdempotencyKey } from '../../contracts/agent-os';
import {
  LumenvaExecutionAdapter,
  shouldExecuteSideEffect,
  type LumenvaExecutionPersistence,
  type LumenvaExecutionRecord,
} from '../../execution/lumenva-execution-adapter';
import type {
  DurableBenchmarkAdapter,
  DurableBenchmarkLifecycleEvent,
  DurableBenchmarkRunInput,
  DurableBenchmarkRunResult,
  DurableBenchmarkTerminalState,
} from '../contracts';
import type { BenchmarkEffectStore } from '../effect-store';
import { shouldInjectFault } from '../fault-plan';
import { getPhase7Scenarios } from '../scenarios';

function createSyntheticExecutionPersistence(): LumenvaExecutionPersistence {
  let record: LumenvaExecutionRecord | null = null;

  return {
    async load({ jobId, organizationId }) {
      if (!record) return null;
      return record.jobId === jobId && record.organizationId === organizationId ? record : null;
    },
    async save(next) {
      record = structuredClone(next);
    },
  };
}

export function createCurrentDurableBenchmarkAdapter(dependencies: {
  effectStore: BenchmarkEffectStore;
}): DurableBenchmarkAdapter {
  return {
    engineId: 'current',
    async run(input: DurableBenchmarkRunInput): Promise<DurableBenchmarkRunResult> {
      const scenario = getPhase7Scenarios().find((candidate) => candidate.id === input.scenarioId);
      if (!scenario) throw new Error(`unknown_benchmark_scenario:${input.scenarioId}`);
      if (scenario.version !== input.scenarioVersion) throw new Error('benchmark_scenario_version_mismatch');
      if (scenario.organizationId !== input.organizationId) throw new Error('benchmark_organization_mismatch');
      if (!input.organizationId.startsWith('bench-org-')) throw new Error('benchmark_requires_synthetic_organization');

      const approvalRequired = scenario.requiresApproval;
      const persistence = createSyntheticExecutionPersistence();
      const execution = new LumenvaExecutionAdapter(persistence);
      const lifecycle: DurableBenchmarkLifecycleEvent[] = [];
      let tick = 0;
      let retryCount = 0;
      let effectAttempts = 0;
      let committedEffects = 0;
      let approvalSatisfied = false;
      let recoveredAfterCrash = false;
      let resumedFromExpectedStep = !approvalRequired;
      let terminalState: DurableBenchmarkTerminalState = scenario.expectedTerminalState;

      const event = (
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

      const jobId = `bench-job:${input.runId}`;
      let state = await execution.start({
        jobId,
        workerId: 'bench-worker-a',
        identity: {
          runId: input.runId,
          organizationId: input.organizationId,
          agentId: 'phase-7-benchmark',
          agentVersion: input.scenarioVersion,
          traceId: `bench-trace:${input.runId}`,
          correlationId: `bench-correlation:${input.runId}`,
        },
      });
      event('started', 'current engine started synthetic benchmark run');

      state = await execution.checkpoint(state, { stepId: 'work-a', data: { synthetic: true } });
      event('checkpoint', 'checkpointed work-a through Lumenva execution boundary', { stepId: 'work-a' });

      if (shouldInjectFault({ scenario, stepId: 'work-a', occurrence: 1 })) {
        const crossTenantFault = scenario.faults.some(
          (fault) => fault.kind === 'cross_tenant_attempt' && fault.stepId === 'work-a' && fault.occurrence === 1,
        );
        if (crossTenantFault) {
          event('tenant_attempt_blocked', 'synthetic cross-tenant attempt was rejected before any effect', {
            stepId: 'work-a',
            attempt: 1,
          });
          await execution.fail(state, new Error('synthetic_cross_tenant_attempt_blocked'));
          terminalState = 'failed';
          return buildResult();
        }
      }

      let workBCompleted = false;
      for (let occurrence = 1; occurrence <= scenario.maxRetries + 1; occurrence += 1) {
        const inject = shouldInjectFault({ scenario, stepId: 'work-b', occurrence });
        if (!inject) {
          event('step_succeeded', 'work-b completed', { stepId: 'work-b', attempt: occurrence });
          workBCompleted = true;
          break;
        }

        event('retryable_failure', 'deterministic transient failure injected at work-b', {
          stepId: 'work-b',
          attempt: occurrence,
        });

        if (occurrence > scenario.maxRetries) {
          await execution.fail(state, new Error('synthetic_retry_limit_exhausted'));
          terminalState = 'failed';
          event('failed', 'retry limit exhausted', { stepId: 'work-b', attempt: occurrence });
          return buildResult();
        }

        retryCount += 1;
        event('retry_scheduled', 'retry permitted by scenario retry limit', {
          stepId: 'work-b',
          attempt: occurrence + 1,
        });
      }

      if (!workBCompleted) {
        await execution.fail(state, new Error('synthetic_work_b_incomplete'));
        terminalState = 'failed';
        return buildResult();
      }

      if (approvalRequired) {
        state = await execution.checkpoint(state, { stepId: 'approval', data: { synthetic: true } });
        state = await execution.pause(state, 'phase_7_synthetic_approval');
        event('approval_wait', 'paused at durable approval boundary', { stepId: 'approval' });

        if (scenario.approvalOutcome === 'reject') {
          await execution.stop(state, 'policy_denied', 'synthetic_approval_rejected');
          terminalState = 'rejected';
          event('approval_rejected', 'synthetic approval was rejected', { stepId: 'approval' });
          return buildResult();
        }

        if (scenario.approvalOutcome === 'expire') {
          await execution.stop(state, 'blocked', 'synthetic_approval_expired');
          terminalState = 'expired';
          event('approval_expired', 'synthetic approval expired without executing effect', { stepId: 'approval' });
          return buildResult();
        }

        state = await execution.resume(state);
        approvalSatisfied = true;
        resumedFromExpectedStep = state.checkpoint?.stepId === 'approval';
        event('approval_resumed', 'resumed from approval checkpoint', { stepId: 'approval' });

        state = await execution.checkpoint(state, { stepId: 'resume', data: { synthetic: true } });
        if (scenario.faults.some((fault) => fault.kind === 'crash' && fault.stepId === 'resume' && fault.occurrence === 1)) {
          event('process_crash', 'synthetic worker interruption occurred after resume checkpoint', {
            stepId: 'resume',
            attempt: 1,
          });
          state = await execution.start({
            jobId,
            workerId: 'bench-worker-b',
            identity: {
              runId: input.runId,
              organizationId: input.organizationId,
              agentId: 'phase-7-benchmark',
              agentVersion: input.scenarioVersion,
              traceId: `bench-trace:${input.runId}`,
              correlationId: `bench-correlation:${input.runId}`,
            },
          });
          recoveredAfterCrash = true;
          resumedFromExpectedStep = state.checkpoint?.stepId === 'resume';
          event('process_recovered', 'new synthetic worker loaded the persisted resume checkpoint', {
            stepId: 'resume',
          });
        }
      }

      const idempotencyKey = deriveToolIdempotencyKey({
        runId: input.runId,
        stepId: 'effect',
        tool: 'phase-7-synthetic-effect',
        businessTarget: { organizationId: input.organizationId, scenarioId: input.scenarioId },
      });
      const requestedEffectAttempts = scenario.faults.some((fault) => fault.kind === 'duplicate_delivery') ? 2 : 1;

      for (let occurrence = 1; occurrence <= requestedEffectAttempts; occurrence += 1) {
        effectAttempts += 1;
        if (!shouldExecuteSideEffect(state, idempotencyKey)) {
          event('duplicate_suppressed', 'Lumenva idempotency checkpoint suppressed duplicate synthetic effect', {
            stepId: 'effect',
            attempt: occurrence,
          });
          continue;
        }

        const effect = await dependencies.effectStore.commitOnce({
          organizationId: input.organizationId,
          idempotencyKey,
        });
        if (effect.committed) committedEffects += 1;
        state = await execution.checkpoint(state, {
          stepId: 'effect',
          data: { synthetic: true, committed: effect.committed },
          completedSideEffectKeys: [idempotencyKey],
        });
        event('effect_committed', 'synthetic effect committed through isolated benchmark store', {
          stepId: 'effect',
          attempt: occurrence,
        });
      }

      await execution.complete(state, { synthetic: true });
      terminalState = 'completed';
      event('completed', 'current engine completed synthetic benchmark run');
      return buildResult();

      function buildResult(): DurableBenchmarkRunResult {
        return {
          engineId: 'current',
          scenarioId: input.scenarioId,
          scenarioVersion: input.scenarioVersion,
          organizationId: input.organizationId,
          runId: input.runId,
          terminalState,
          lifecycle,
          retryCount,
          approvalRequired,
          approvalSatisfied,
          resumedFromExpectedStep,
          effectAttempts,
          committedEffects,
          recoveredAfterCrash,
          crossTenantViolation: false,
          durationMs: Math.max(0, tick - 1),
          engineVersion: 'lumenva-execution-adapter-v1',
        };
      }
    },
  };
}
