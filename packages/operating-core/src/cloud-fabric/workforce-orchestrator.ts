import type {
  ExecutionPort,
  ExecutionResult,
  MasterPlan,
  MasterPlanTask,
  TaskContract,
} from './execution-port';
import { ResourceRouter } from './resource-router';
import { ContextEngine, type ContextBuildInput } from '../context/context-engine';
import { toResultDigest } from './result-digest';
import { evidenceGate } from './evidence-gate';
import type { WorkforcePersistence } from './durable-stores';
import { requiresOwnerApproval } from './approval-gate';
import { IdempotencyStore, executionIdempotencyKey } from './idempotency';
import { CostLedger } from './cost-ledger';
import type { ContextResolver } from './context-resolver';
import type { LearningRouter } from './learning-router';
import type { ReviewResult } from './independent-review';
import { executeIndependentReview } from './reviewer-executor';
import { createRoutingTrace } from './trace-factory';
import { executeWithRetry } from './execution-loop';
import { nextEscalation, type EscalationState } from './escalation-engine';
import { readyTasks } from './master-plan';

export interface PortResolver {
  resolve(provider: string, model?: string): ExecutionPort | undefined;
}

export interface OrchestrationTaskResult {
  task: MasterPlanTask;
  contract: TaskContract;
  execution?: ExecutionResult;
  review?: ReviewResult;
  status: 'completed' | 'blocked' | 'failed';
  reason?: string;
}

export interface OrchestrationRun {
  plan_id: string;
  completed: string[];
  blocked: string[];
  failed: string[];
  results: OrchestrationTaskResult[];
}

export class WorkforceOrchestrator {
  constructor(
    private readonly router: ResourceRouter,
    private readonly ports: PortResolver,
    private readonly context: ContextEngine = new ContextEngine(),
    private readonly persistence?: WorkforcePersistence,
    private readonly idempotency = new IdempotencyStore<ExecutionResult>(),
    private readonly costLedger = new CostLedger(),
    private readonly contextResolver?: ContextResolver,
    private readonly learning?: LearningRouter,
  ) {}

  async runPlan(plan: MasterPlan, baseSha: string): Promise<OrchestrationRun> {
    await this.persistence?.savePlan(plan);
    const completed = new Set<string>();
    const blocked = new Set<string>();
    const failed = new Set<string>();
    const results: OrchestrationTaskResult[] = [];

    while (completed.size + blocked.size + failed.size < plan.tasks.length) {
      const ready = readyTasks(plan, [...completed, ...blocked, ...failed]).filter((task) =>
        (task.depends_on ?? []).every((dependency) => completed.has(dependency)),
      );

      if (ready.length === 0) {
        for (const task of plan.tasks) {
          if (!completed.has(task.task_id) && !blocked.has(task.task_id) && !failed.has(task.task_id)) {
            blocked.add(task.task_id);
            results.push({
              task,
              contract: this.contractFor(plan, task, baseSha),
              status: 'blocked',
              reason: 'dependency_not_completed',
            });
          }
        }
        break;
      }

      for (const task of ready) {
        const contract = this.contractFor(plan, task, baseSha);
        if (requiresOwnerApproval(contract)) {
          blocked.add(task.task_id);
          results.push({ task, contract, status: 'blocked', reason: 'owner_approval_required' });
          continue;
        }

        const routed = await this.router.route({
          capability: task.capabilities ?? [],
          priority: 1,
          risk: task.risk,
          complexity: task.complexity,
          phase: 'execute',
        });

        const port = routed.adapter ?? this.ports.resolve(String(routed.provider), routed.model?.model);
        if (!port) {
          blocked.add(task.task_id);
          results.push({ task, contract, status: 'blocked', reason: 'execution_port_unavailable' });
          continue;
        }

        const resolvedContext = this.contextResolver?.resolve(contract) ?? { sources: [], allowed_tools: [], provenance: [] };
        const packetInput: ContextBuildInput = {
          contract,
          sources: resolvedContext.sources,
          allowed_tools: resolvedContext.allowed_tools,
          token_budget: 8000,
          expansion_level: 1,
          provenance: [`masterplan:${plan.plan_id}`, ...resolvedContext.provenance],
        };
        const packet = this.context.compilePacket(packetInput);
        contract.context_packet_id = packet.context_packet_id;

        const executionKey = executionIdempotencyKey(plan.plan_id, task.task_id, baseSha, 1);
        await this.persistence?.saveRoutingTrace(createRoutingTrace({ task_id: task.task_id, phase: 'execute', decision: routed, context_packet_id: packet.context_packet_id }));
        const loop = await this.idempotency.once(executionKey, () => executeWithRetry(port, contract));
        const execution = loop.result;
        this.costLedger.record(execution);
        await this.persistence?.saveExecution(execution);
        const gate = evidenceGate(execution, task.risk);
        if (execution.status !== 'success' || !gate.passed) {
          const target = execution.status === 'blocked' || execution.status === 'waiting_for_approval'
            ? blocked
            : failed;
          target.add(task.task_id);
          results.push({ task, contract, execution, status: target === blocked ? 'blocked' : 'failed', reason: gate.reasons.join(',') });
          continue;
        }

        const reviewTarget = await this.router.route({
          capability: ['review'],
          priority: 1,
          risk: task.risk,
          complexity: task.complexity,
          phase: 'verify',
        });
        const reviewerProvider = String(reviewTarget.provider);
        const reviewerPort = reviewTarget.adapter ?? this.ports.resolve(reviewerProvider, reviewTarget.model?.model);
        if (!reviewerPort || reviewerProvider === (execution.provider ?? String(routed.provider))) {
          failed.add(task.task_id);
          results.push({ task, contract, execution, status: 'failed', reason: 'independent_reviewer_unavailable' });
          continue;
        }
        await this.persistence?.saveRoutingTrace(createRoutingTrace({ task_id: task.task_id, phase: 'verify', decision: reviewTarget, execution_id: execution.execution_id, context_packet_id: packet.context_packet_id }));
        const { reviewExecution, review } = await executeIndependentReview({
          implementation: execution,
          contract,
          risk: task.risk,
          target: { provider: reviewerProvider, model: reviewTarget.model?.model, port: reviewerPort },
        });
        await this.persistence?.saveExecution(reviewExecution);

        const observation = {
          model_id: execution.model ?? execution.provider ?? String(routed.provider),
          task_type: task.capabilities?.[0] ?? 'general',
          complexity: task.complexity,
          risk: task.risk,
          success: execution.status === 'success',
          reviewer_accepted: review.accepted,
          deterministic_passed: execution.tests.length > 0 && execution.tests.every((test) => test.passed),
          retries: Math.max(0, loop.attempts.length - 1),
          latency_ms: execution.usage?.duration_ms,
          cost_usd: execution.usage?.cost_usd,
        };
        this.learning?.record(observation);
        await this.persistence?.saveObservation(observation);

        if (!review.accepted) {
          failed.add(task.task_id);
          results.push({ task, contract, execution, review, status: 'failed', reason: review.reasons.join(',') });
          continue;
        }

        completed.add(task.task_id);
        const digest = toResultDigest(execution);
        await this.persistence?.saveDigest(digest);
        results.push({ task, contract, execution, review, status: 'completed' });
      }
    }

    return {
      plan_id: plan.plan_id,
      completed: [...completed],
      blocked: [...blocked],
      failed: [...failed],
      results,
    };
  }

  private contractFor(plan: MasterPlan, task: MasterPlanTask, baseSha: string): TaskContract {
    return {
      task_id: task.task_id,
      plan_id: plan.plan_id,
      goal: task.objective,
      scope: task.objective,
      allowed_paths: [],
      constraints: plan.constraints,
      acceptance_criteria: task.acceptance_criteria,
      evidence_requirements: task.evidence_requirements,
      capabilities: task.capabilities,
      risk: task.risk,
      complexity: task.complexity,
      base_sha: baseSha,
      max_attempts: 1,
    };
  }
}
