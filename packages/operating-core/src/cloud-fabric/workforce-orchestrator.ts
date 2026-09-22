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
import { evaluateIndependentReview, type ReviewResult } from './independent-review';
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
  ) {}

  async runPlan(plan: MasterPlan, baseSha: string): Promise<OrchestrationRun> {
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

        const packetInput: ContextBuildInput = {
          contract,
          allowed_tools: [],
          token_budget: 8000,
          expansion_level: 1,
          provenance: [`masterplan:${plan.plan_id}`],
        };
        const packet = this.context.compilePacket(packetInput);
        contract.context_packet_id = packet.context_packet_id;

        const execution = await port.execute(contract);
        if (execution.status !== 'success') {
          const target = execution.status === 'blocked' || execution.status === 'waiting_for_approval'
            ? blocked
            : failed;
          target.add(task.task_id);
          results.push({ task, contract, execution, status: target === blocked ? 'blocked' : 'failed' });
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
        const review = evaluateIndependentReview({
          implementation: execution,
          reviewer_provider: reviewerProvider,
          reviewer_model: reviewTarget.model?.model,
          risk: task.risk,
          deterministic_checks: execution.tests.map((test, index) => ({
            name: test.name ?? `test-${index + 1}`,
            passed: test.passed,
            evidence: test.report,
          })),
        });

        if (!review.accepted) {
          failed.add(task.task_id);
          results.push({ task, contract, execution, review, status: 'failed', reason: review.reasons.join(',') });
          continue;
        }

        completed.add(task.task_id);
        void toResultDigest(execution);
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
