import {
  deriveToolIdempotencyKey,
  evaluateLoopBudget,
  evaluateNoProgress,
  evaluateRepeatedTool,
  isAutonomyEligibleRisk,
  type AgentLoopUsage,
  type AgentRunStatus,
  type ToolInvocationFingerprintInput,
} from "../contracts/agent-os";
import type { AgentKernel, AgentKernelInput, AgentKernelResult, ResolvedKernelExecution } from "./contracts";
import type { AgentKernelDependencies, KernelExecutionState } from "./ports";
import { resolveKernelExecution } from "./resolution";

function unresolvedResult(input: AgentKernelInput, reason: string): AgentKernelResult {
  return {
    status: "blocked",
    stopReason: reason,
    runId: input.runId ?? "unresolved",
    traceId: input.traceId ?? "unresolved",
    correlationId: input.correlationId ?? "unresolved",
  };
}

function resultFor(
  execution: ResolvedKernelExecution,
  status: AgentRunStatus,
  stopReason: string,
  extra: Pick<AgentKernelResult, "approvalId" | "output"> = {},
): AgentKernelResult {
  return {
    status,
    stopReason,
    runId: execution.runId,
    traceId: execution.traceId,
    correlationId: execution.correlationId,
    ...(execution.definition.conversationStyle
      ? { conversationStyle: execution.definition.conversationStyle }
      : {}),
    ...extra,
  };
}

async function stop(
  dependencies: AgentKernelDependencies,
  execution: ResolvedKernelExecution,
  state: KernelExecutionState,
  status: AgentRunStatus,
  reason: string,
): Promise<AgentKernelResult> {
  await dependencies.execution.stop(state, status, reason);
  await dependencies.evidence.record({
    runId: execution.runId,
    traceId: execution.traceId,
    kind: "kernel_stopped",
    payload: { status, reason },
  });
  return resultFor(execution, status, reason);
}

export function createAgentKernel(dependencies: AgentKernelDependencies): AgentKernel {
  return {
    async run(input) {
      const resolution = await resolveKernelExecution(input, dependencies);
      if (resolution.kind === "blocked") return unresolvedResult(input, resolution.reason);

      const { execution } = resolution;
      const context = await dependencies.loadContext(execution);
      const skills = await dependencies.loadSkills(execution, context);
      const tools = await dependencies.resolveTools(execution, skills);
      const model = await dependencies.selectModel(execution);
      if (model === null || !model.enabled || !model.certified) {
        return unresolvedResult(
          { ...input, runId: execution.runId, traceId: execution.traceId, correlationId: execution.correlationId },
          "model_unavailable",
        );
      }

      const missingCapability = execution.definition.requiredModelCapabilities.find(
        (capability) => !model.capabilities.includes(capability),
      );
      if (missingCapability !== undefined) {
        return unresolvedResult(
          { ...input, runId: execution.runId, traceId: execution.traceId, correlationId: execution.correlationId },
          `model_missing_capability:${missingCapability}`,
        );
      }

      let state = execution.resume
        ? await dependencies.execution.resume({ status: "running", completedSideEffectKeys: [] })
        : await dependencies.execution.start(execution);

      const usage: AgentLoopUsage = { steps: 0, toolCalls: 0, tokensUsed: 0, costCents: 0, runtimeMs: 0 };
      const toolHistory: ToolInvocationFingerprintInput[] = [];
      const progressHistory: string[] = [];
      let previousToolResult: unknown;

      await dependencies.evidence.record({
        runId: execution.runId,
        traceId: execution.traceId,
        kind: "kernel_started",
        payload: { organizationId: execution.organizationId, agentId: execution.agentId, model: model.id },
      });

      try {
        while (true) {
          const beforeStep = evaluateLoopBudget(execution.definition.loop, usage);
          if (beforeStep.kind === "stop") {
            return await stop(dependencies, execution, state, "budget_exhausted", beforeStep.reason);
          }

          const step = await dependencies.runtime.step({
            execution,
            context,
            skills,
            tools,
            model,
            usage: { ...usage },
            previousToolResult,
          });

          usage.steps += 1;
          usage.tokensUsed += step.usage.tokens;
          usage.costCents += step.usage.costCents;
          usage.runtimeMs += step.usage.latencyMs;
          progressHistory.push(step.progressFingerprint);

          await dependencies.evidence.record({
            runId: execution.runId,
            traceId: execution.traceId,
            kind: `kernel_step_${step.kind}`,
            payload: { steps: usage.steps, tokens: usage.tokensUsed, costCents: usage.costCents },
          });

          if (step.kind === "final") {
            const hardBudget = evaluateLoopBudget(
              { ...execution.definition.loop, maxSteps: Number.MAX_SAFE_INTEGER, maxToolCalls: Number.MAX_SAFE_INTEGER },
              usage,
            );
            if (hardBudget.kind === "stop") {
              return await stop(dependencies, execution, state, "budget_exhausted", hardBudget.reason);
            }

            const verification = await dependencies.verification.verify({ execution, output: step.output });
            if (!verification.passed) {
              return await stop(dependencies, execution, state, "blocked", "verification_failed");
            }

            if (!["off", "shadow", "draft"].includes(execution.definition.autonomyLevel)) {
              await dependencies.memory.write({ execution, value: step.output });
            }
            state = await dependencies.execution.complete(state, step.output);
            await dependencies.events.emit({ execution, type: "agent_kernel.completed", payload: { verification: verification.evidence } });
            return resultFor(execution, state.status, "completed", { output: step.output });
          }

          usage.toolCalls += 1;
          const tool = tools.definitions.get(step.toolId);
          if (tool === undefined) {
            return await stop(dependencies, execution, state, "policy_denied", "tool_not_exposed");
          }
          if (!isAutonomyEligibleRisk(tool.risk)) {
            return await stop(dependencies, execution, state, "policy_denied", "r4_non_autonomous");
          }
          if (tool.hasSideEffect && ["off", "shadow", "draft"].includes(execution.definition.autonomyLevel)) {
            return await stop(dependencies, execution, state, "policy_denied", "autonomy_side_effect_blocked");
          }

          const idempotencyKey = deriveToolIdempotencyKey({
            runId: execution.runId,
            stepId: step.stepId,
            tool: step.toolId,
            businessTarget: step.businessTarget,
          });
          toolHistory.push({ tool: step.toolId, args: step.args });

          const repeated = evaluateRepeatedTool(execution.definition.loop, toolHistory);
          if (repeated.kind === "stop") {
            return await stop(dependencies, execution, state, "blocked", repeated.reason);
          }
          const noProgress = evaluateNoProgress(execution.definition.loop, progressHistory);
          if (noProgress.kind === "stop") {
            return await stop(dependencies, execution, state, "blocked", noProgress.reason);
          }

          if (tool.hasSideEffect && state.completedSideEffectKeys.includes(idempotencyKey)) {
            previousToolResult = { kind: "duplicate_suppressed", idempotencyKey };
            continue;
          }

          const gatewayResult = await dependencies.toolGateway.execute({
            execution,
            tool,
            args: step.args,
            idempotencyKey,
          });

          if (gatewayResult.kind === "denied") {
            return await stop(dependencies, execution, state, "policy_denied", gatewayResult.reason);
          }
          if (gatewayResult.kind === "approval_required") {
            state = await dependencies.execution.pause(state, gatewayResult.reason);
            return resultFor(execution, "waiting_approval", gatewayResult.reason, { approvalId: gatewayResult.approvalId });
          }

          const completedSideEffectKeys = tool.hasSideEffect
            ? [...state.completedSideEffectKeys, idempotencyKey]
            : state.completedSideEffectKeys;
          state = await dependencies.execution.checkpoint(state, {
            stepId: step.stepId,
            completedSideEffectKeys,
          });
          previousToolResult = gatewayResult.result;
        }
      } catch (error) {
        await dependencies.execution.fail(state, error);
        await dependencies.evidence.record({
          runId: execution.runId,
          traceId: execution.traceId,
          kind: "kernel_failed",
        });
        return resultFor(execution, "permanent_failure", "runtime_error");
      }
    },
  };
}
