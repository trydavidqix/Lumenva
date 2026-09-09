import type { ResolvedKernelExecution } from "./contracts";
import type { KernelSkillBundle, KernelToolBundle, KernelToolDefinition } from "./ports";

export function composeKernelTools(
  execution: ResolvedKernelExecution,
  skills: KernelSkillBundle,
  registry: readonly KernelToolDefinition[],
): KernelToolBundle {
  const agentAllowed = new Set(execution.definition.allowedTools);
  const skillRequested = skills.requestedToolIds === undefined ? null : new Set(skills.requestedToolIds);

  const selected = registry.filter((tool) => {
    if (!agentAllowed.has(tool.id)) return false;
    if (skillRequested !== null && !skillRequested.has(tool.id)) return false;
    return true;
  });

  return { definitions: new Map(selected.map((tool) => [tool.id, tool])) };
}

export interface KernelToolResolverDependencies {
  loadRegistry(execution: ResolvedKernelExecution): Promise<readonly KernelToolDefinition[]>;
}

export function createKernelToolResolver(dependencies: KernelToolResolverDependencies) {
  return async (execution: ResolvedKernelExecution, skills: KernelSkillBundle): Promise<KernelToolBundle> => {
    const registry = await dependencies.loadRegistry(execution);
    return composeKernelTools(execution, skills, registry);
  };
}
