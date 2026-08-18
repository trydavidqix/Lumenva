import {
  deriveToolIdempotencyKey,
  evaluateLoopBudget,
  evaluateNoProgress,
  evaluateRepeatedTool,
  type AgentLoopUsage,
  type ToolInvocationFingerprintInput,
} from '../contracts/agent-os';
import { filterCertifiedModels, type ModelCapability } from '../models/certification';
import { resolveKernelExecution } from './resolution';
import type { AgentKernel, AgentKernelInput, AgentKernelResult, ResolvedKernelExecution } from './contracts';
import type { AgentKernelDependencies, KernelExecutionState } from './ports';

function fallbackIdentity(input: AgentKernelInput): Pick<AgentKernelResult, 'runId' | 'traceId' | 'correlationId'> {
  return {
    runId: input.runId ?? `blocked:${input.agentId}`,
    traceId: input.traceId ?? `blocked:${input.agentId}`,
    correlationId: input.correlationId ?? input.traceId ?? `blocked:${input.agentId}`,
  };
}

function result(
  execution: ResolvedKernelExecution,
  status: AgentKernelResult['status'],
  stopReason: string,
  output?: unknown,
  approvalId?: string,
): AgentKernelResult {
  return {
    status,
    stopReason,
    runId: execution.runId,
    traceId: execution.traceId,
    correlationId: execution.correlationId,
    ...(approvalId === undefined ? {} : { approvalId }),
    ...(output === undefined ? {} : { output }),
  };
}

async function stopForProgressGuard(
  dependencies: AgentKernelDependencies,
  execution: ResolvedKernelExecution,
  state: KernelExecutionState,
  reason: 'repeated_tool_exhausted' | 'no_progress_exhausted',
): Promise<AgentKernelResult> {
  const stopped = await dependencies.execution.stop(state, 'blocked', reason);
  await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'run_stopped', payload: { reason } });
  await dependencies.events.emit({ execution, type: 'agent_run_stopped', payload: { reason } });
  return result(execution, stopped.status, reason);
}

function isRetryableToolError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'retryable' in error && (error as { retryable?: unknown }).retryable === true);
}

function evaluateToolFailure(
  tool: { maxRetries: number },
  input: { failureCount: number; retryable: boolean },
): { kind: 'retry' | 'stop'; reason: string } {
  if (input.retryable && input.failureCount <= tool.maxRetries) return { kind: 'retry', reason: 'tool_retryable_failure' };
  return { kind: 'stop', reason: input.retryable ? 'tool_retry_exhausted' : 'tool_permanent_failure' };
}

export function createAgentKernel(dependencies: AgentKernelDependencies): AgentKernel {
  return {
    async run(input) {
      const resolution = await resolveKernelExecution(input, {
        resolveAgent: dependencies.resolveAgent,
        createIdentity: dependencies.createIdentity,
      });
      if (resolution.kind === 'blocked') {
        return { status: 'blocked', stopReason: resolution.reason, ...fallbackIdentity(input) };
      }

      const { agent: resolvedAgent, execution } = resolution;
      const requiredCapabilities = resolvedAgent.definition.requiredModelCapabilities as readonly ModelCapability[];
      const [model] = filterCertifiedModels(dependencies.models, { requiredCapabilities });
      if (model === undefined) {
        await dependencies.evidence.record({
          runId: execution.runId,
          traceId: execution.traceId,
          kind: 'model_selection_blocked',
          payload: { requiredCapabilities: [...requiredCapabilities] },
        });
        return result(execution, 'blocked', 'no_certified_compatible_model');
      }

      const context = await dependencies.loadContext(execution);
      const skills = await dependencies.loadSkills(execution, context);
      const tools = await dependencies.resolveTools(execution, skills);

      let state = await dependencies.execution.start(execution);
      if (execution.resume) state = await dependencies.execution.resume(state);

      await dependencies.evidence.record({
        runId: execution.runId,
        traceId: execution.traceId,
        kind: 'run_started',
        payload: {
          agentId: execution.agentId,
          agentVersion: execution.agentVersion,
          triggerEventId: execution.trigger.eventId,
          contextSources: context.sources,
          activatedSkillVersions: skills.activatedSkillVersions,
          provider: model.provider,
          model: model.model,
        },
      });
      await dependencies.events.emit({ execution, type: 'agent_run_started', payload: { provider: model.provider, model: model.model } });

      const usage: AgentLoopUsage = { steps: 0, toolCalls: 0, tokensUsed: 0, costCents: 0, runtimeMs: 0 };
      const toolHistory: ToolInvocationFingerprintInput[] = [];
      const progressHistory: string[] = [];
      let previousToolResult: unknown;

      for (;;) {
        const budget = evaluateLoopBudget(execution.definition.loop, usage);
        if (budget.kind === 'stop') {
          state = await dependencies.execution.stop(state, 'budget_exhausted', budget.reason);
          await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'run_stopped', payload: { reason: budget.reason, usage: { ...usage } } });
          await dependencies.events.emit({ execution, type: 'agent_run_stopped', payload: { reason: budget.reason } });
          return result(execution, state.status, budget.reason);
        }

        const step = await dependencies.runtime.step({
          execution,
          context,
          skills,
          tools,
          model,
          usage: { ...usage },
          ...(previousToolResult === undefined ? {} : { previousToolResult }),
        });
        usage.steps += 1;
        usage.tokensUsed += step.usage.tokens;
        usage.costCents += step.usage.costCents;
        usage.runtimeMs += step.usage.latencyMs;

        if (step.kind === 'tool_call') {
          const tool = tools.definitions.get(step.toolId);
          if (tool === undefined) {
            state = await dependencies.execution.stop(state, 'policy_denied', 'tool_not_resolved');
            return result(execution, state.status, 'tool_not_resolved');
          }

          toolHistory.push({ tool: step.toolId, args: step.args });
          progressHistory.push(step.progressFingerprint);
          const repeated = evaluateRepeatedTool(execution.definition.loop, toolHistory);
          if (repeated.kind === 'stop') return stopForProgressGuard(dependencies, execution, state, repeated.reason);
          const noProgress = evaluateNoProgress(execution.definition.loop, progressHistory);
          if (noProgress.kind === 'stop') return stopForProgressGuard(dependencies, execution, state, noProgress.reason);

          usage.toolCalls += 1;
          const idempotencyKey = deriveToolIdempotencyKey({ runId: execution.runId, stepId: step.stepId, tool: step.toolId, businessTarget: step.businessTarget });
          state = await dependencies.execution.checkpoint(state, { stepId: step.stepId });

          if (tool.hasSideEffect && state.completedSideEffectKeys.includes(idempotencyKey)) {
            previousToolResult = { skippedReplay: true, idempotencyKey };
            await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'side_effect_replay_skipped', payload: { toolId: tool.id, idempotencyKey } });
            continue;
          }

          let gatewayResult;
          let failureCount = 0;
          for (;;) {
            try {
              gatewayResult = await dependencies.toolGateway.execute({ execution, tool, args: step.args, idempotencyKey });
              break;
            } catch (error) {
              failureCount += 1;
              const retryable = isRetryableToolError(error);
              const failure = evaluateToolFailure(tool, { failureCount, retryable });
              await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: failure.kind === 'retry' ? 'tool_retry' : 'tool_failure', payload: { toolId: tool.id, idempotencyKey, failureCount, retryable, reason: failure.reason } });
              if (failure.kind === 'retry') continue;
              const status = retryable ? 'retryable_failure' : 'permanent_failure';
              state = await dependencies.execution.stop(state, status, failure.reason);
              await dependencies.events.emit({ execution, type: 'agent_run_failed', payload: { reason: failure.reason, toolId: tool.id } });
              return result(execution, state.status, failure.reason);
            }
          }

          if (gatewayResult.kind === 'denied') {
            state = await dependencies.execution.stop(state, 'policy_denied', gatewayResult.reason);
            await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'tool_policy_denied', payload: { toolId: tool.id, reason: gatewayResult.reason } });
            return result(execution, state.status, gatewayResult.reason);
          }
          if (gatewayResult.kind === 'draft') {
            state = await dependencies.execution.complete(state, gatewayResult.proposal);
            await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'draft_proposed', payload: { toolId: tool.id, idempotencyKey, usage: { ...usage } } });
            await dependencies.events.emit({ execution, type: 'agent_run_completed', payload: { reason: 'draft_proposed', usage: { ...usage } } });
            return result(execution, state.status, 'draft_proposed', gatewayResult.proposal);
          }
          if (gatewayResult.kind === 'pending_approval') {
            state = await dependencies.execution.pause(state, 'approval_required');
            await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'approval_required', payload: { toolId: tool.id, approvalId: gatewayResult.approvalId } });
            return result(execution, state.status, 'approval_required', undefined, gatewayResult.approvalId);
          }

          previousToolResult = gatewayResult.result;
          state = await dependencies.execution.checkpoint(state, { stepId: step.stepId, completedSideEffectKeys: tool.hasSideEffect ? [idempotencyKey] : undefined });
          await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'tool_executed', payload: { toolId: tool.id, idempotencyKey } });
          continue;
        }

        const verification = await dependencies.verification.verify({ execution, output: step.output });
        if (!verification.passed) {
          state = await dependencies.execution.fail(state, new Error('verification_failed'));
          await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'verification_failed', payload: { evidence: verification.evidence, stopReason: 'verification_failed', usage: { ...usage } } });
          await dependencies.events.emit({ execution, type: 'agent_run_failed', payload: { reason: 'verification_failed' } });
          return result(execution, state.status, 'verification_failed');
        }

        await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'verification_passed', payload: { evidence: verification.evidence, usage: { ...usage } } });
        await dependencies.memory.write({ execution, value: step.output });
        state = await dependencies.execution.complete(state, step.output);
        await dependencies.evidence.record({ runId: execution.runId, traceId: execution.traceId, kind: 'run_completed', payload: { stopReason: 'goal_completed', usage: { ...usage } } });
        await dependencies.events.emit({ execution, type: 'agent_run_completed', payload: { usage: { ...usage } } });
        return result(execution, state.status, 'goal_completed', step.output);
      }
    },
  };
}
