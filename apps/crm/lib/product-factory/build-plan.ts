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
