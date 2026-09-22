import type { MasterPlan, MasterPlanTask, RiskLevel, TaskComplexity } from './execution-port';

export interface MasterPlanInput {
  objective: string;
  business_context?: string;
  assumptions?: string[];
  requirements?: string[];
  architecture?: string[];
  decisions?: string[];
  constraints?: string[];
  risks?: string[];
  dependencies?: string[];
  tasks: Array<Partial<MasterPlanTask> & Pick<MasterPlanTask, 'task_id' | 'objective'>>;
  validation_strategy?: string[];
  escalation_policy?: string[];
  source_agent?: string;
  source_model?: string;
}

export function createMasterPlan(input: MasterPlanInput): MasterPlan {
  const seen = new Set<string>();
  const tasks: MasterPlanTask[] = input.tasks.map((task) => {
    if (seen.has(task.task_id)) throw new Error(`duplicate_task_id:${task.task_id}`);
    seen.add(task.task_id);
    return {
      task_id: task.task_id,
      objective: task.objective,
      depends_on: [...new Set(task.depends_on ?? [])],
      capabilities: [...new Set(task.capabilities ?? [])],
      risk: (task.risk ?? 'R1') as RiskLevel,
      complexity: (task.complexity ?? 'NORMAL') as TaskComplexity,
      acceptance_criteria: task.acceptance_criteria ?? [],
      evidence_requirements: task.evidence_requirements ?? [],
    };
  });

  for (const task of tasks) {
    for (const dependency of task.depends_on ?? []) {
      if (!seen.has(dependency)) throw new Error(`unknown_dependency:${task.task_id}->${dependency}`);
      if (dependency === task.task_id) throw new Error(`self_dependency:${task.task_id}`);
    }
  }

  detectCycle(tasks);

  return {
    plan_id: createPlanId(input.objective, tasks),
    objective: input.objective,
    business_context: input.business_context,
    assumptions: input.assumptions ?? [],
    requirements: input.requirements ?? [],
    architecture: input.architecture ?? [],
    decisions: input.decisions ?? [],
    constraints: input.constraints ?? [],
    risks: input.risks ?? [],
    dependencies: input.dependencies ?? [],
    tasks,
    validation_strategy: input.validation_strategy ?? [],
    escalation_policy: input.escalation_policy ?? [],
    created_at: new Date().toISOString(),
    source_agent: input.source_agent,
    source_model: input.source_model,
  };
}

export function readyTasks(plan: MasterPlan, completedTaskIds: Iterable<string>): MasterPlanTask[] {
  const completed = new Set(completedTaskIds);
  return plan.tasks.filter((task) =>
    !completed.has(task.task_id) && (task.depends_on ?? []).every((dependency) => completed.has(dependency)),
  );
}

function detectCycle(tasks: MasterPlanTask[]): void {
  const graph = new Map(tasks.map((task) => [task.task_id, task.depends_on ?? []]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`task_cycle_detected:${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of graph.keys()) visit(id);
}

function createPlanId(objective: string, tasks: MasterPlanTask[]): string {
  const input = `${objective}|${tasks.map((task) => task.task_id).join('|')}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `plan_${(hash >>> 0).toString(16)}`;
}
