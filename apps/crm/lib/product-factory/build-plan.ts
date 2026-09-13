import { BuildPlanStateStore } from "./build-plan-state-store";
export type BuildPlanStatus =
  | "DRAFT" | "VALIDATED" | "AUTHORIZED" | "QUEUED" | "RUNNING" | "PREVIEW"
  | "TESTING" | "RELEASE_CANDIDATE" | "RELEASED" | "FAILED" | "CANCELLED" | "BLOCKED_EXTERNAL";

export type BuildPlanStepStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "BLOCKED" | "SKIPPED";

export type BuildPlanStep = {
  step_id: string;
  dependencies: string[];
  status: BuildPlanStepStatus;
};

export type BuildPlan = {
  build_plan_id: string;
  organization_id: string;
  project_id: string;
  source_spec_refs: string[];
  asset_manifest_refs: string[];
  target_repo_ref: string;
  target_branch: string;
  base_sha: string;
  allowed_paths: string[];
  forbidden_paths: string[];
  commands: string[];
  test_commands: string[];
  acceptance_criteria: string[];
  budget_ref?: string;
  authority_envelope_ref: string;
  status: BuildPlanStatus;
  idempotency_key: string;
  steps: BuildPlanStep[];
};

export type BuildPlanValidation = { valid: boolean; errors: string[] };

export type RepairExecutionResult = "SUCCEEDED" | "FAILED";
export type RepairStepExecutor = (step: BuildPlanStep, plan: BuildPlan) => RepairExecutionResult | Promise<RepairExecutionResult>;
export type RepairLoopResult = { plan: BuildPlan; attempts: number; status: "REPAIRED" | "BLOCKED" };

const terminallyBlockedPlans = new Set<string>();

const repairPlanKey = (buildPlan: BuildPlan): string =>
  `${buildPlan.organization_id}:${buildPlan.build_plan_id}:${buildPlan.idempotency_key}`;

export async function repairFailedBuildPlan(
  buildPlan: BuildPlan,
  executeStep: RepairStepExecutor,
  options: { maxAttempts: number; stateStore?: BuildPlanStateStore },
): Promise<RepairLoopResult> {
  const key = repairPlanKey(buildPlan);
  if (buildPlan.status === "BLOCKED_EXTERNAL" || buildPlan.steps.some((step) => step.status === "BLOCKED")) throw new Error("BuildPlan is terminally BLOCKED");
  if (!options.stateStore && terminallyBlockedPlans.has(key)) throw new Error("BuildPlan is terminally BLOCKED");
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) throw new RangeError("maxAttempts must be a positive integer");
  const failedIndex = buildPlan.steps.findIndex((step) => step.status === "FAILED");
  if (failedIndex === -1) throw new Error("BuildPlan has no FAILED step");
  const steps = buildPlan.steps.map((step) => ({ ...step, dependencies: [...step.dependencies] }));
  const plan = { ...buildPlan, steps };
  const failedStep = steps[failedIndex]!;
  if (!options.stateStore) {
    let attempts = 0;
    while (attempts < options.maxAttempts) {
      attempts += 1;
      const result = await executeStep(failedStep, plan).catch(() => "FAILED" as const);
      if (result === "SUCCEEDED") { failedStep.status = "SUCCEEDED"; return { plan, attempts, status: "REPAIRED" }; }
    }
    failedStep.status = "BLOCKED"; plan.status = "BLOCKED_EXTERNAL"; terminallyBlockedPlans.add(key);
    return { plan, attempts, status: "BLOCKED" };
  }
  while (true) {
    const persisted = await options.stateStore.get(buildPlan.organization_id, buildPlan.build_plan_id, failedStep.step_id);
    if (persisted?.status === "BLOCKED") throw new Error("BuildPlan is terminally BLOCKED");
    if (persisted?.status === "RUNNING") throw new Error("BuildPlan step already RUNNING");
    if ((persisted?.attempts ?? 0) >= options.maxAttempts) {
      failedStep.status = "BLOCKED"; plan.status = "BLOCKED_EXTERNAL";
      await options.stateStore.finish(buildPlan.organization_id, buildPlan.build_plan_id, failedStep.step_id, "BLOCKED");
      return { plan, attempts: persisted.attempts, status: "BLOCKED" };
    }
    const attempt = await options.stateStore.recordAttempt(buildPlan.organization_id, buildPlan.build_plan_id, failedStep.step_id);
    if (!attempt) throw new Error("BuildPlan step already BLOCKED");
    const result = await executeStep(failedStep, plan).catch(() => "FAILED" as const);
    if (result === "SUCCEEDED") { failedStep.status = "SUCCEEDED"; await options.stateStore.finish(buildPlan.organization_id, buildPlan.build_plan_id, failedStep.step_id, "SUCCEEDED"); return { plan, attempts: attempt.attempts, status: "REPAIRED" }; }
    await options.stateStore.finish(buildPlan.organization_id, buildPlan.build_plan_id, failedStep.step_id, "FAILED");
  }
}

export function validateBuildPlan(buildPlan: BuildPlan): BuildPlanValidation {
  const errors: string[] = [];
  const stepIds = new Set<string>();

  for (const step of buildPlan.steps) {
    if (stepIds.has(step.step_id)) errors.push(`duplicate step id: ${step.step_id}`);
    stepIds.add(step.step_id);
  }

  for (const step of buildPlan.steps) {
    for (const dependency of step.dependencies) {
      if (!stepIds.has(dependency)) {
        errors.push(`unknown dependency "${dependency}" referenced by step "${step.step_id}"`);
      }
    }
  }

  const dependencies = new Map(buildPlan.steps.map((step) => [step.step_id, step.dependencies]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (stepId: string, path: string[]): void => {
    if (visiting.has(stepId)) {
      const cycleStart = path.indexOf(stepId);
      errors.push(`circular dependency: ${[...path.slice(cycleStart), stepId].join(" -> ")}`);
      return;
    }
    if (visited.has(stepId)) return;
    visiting.add(stepId);
    for (const dependency of dependencies.get(stepId) ?? []) {
      if (dependencies.has(dependency)) walk(dependency, [...path, stepId]);
    }
    visiting.delete(stepId);
    visited.add(stepId);
  };
  for (const step of buildPlan.steps) walk(step.step_id, []);

  return { valid: errors.length === 0, errors };
}
