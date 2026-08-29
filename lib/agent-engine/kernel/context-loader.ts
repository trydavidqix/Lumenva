import type { ResolvedKernelExecution } from "./contracts";
import type { KernelContextBundle, KernelSkillBundle } from "./ports";

export interface KernelContextLoaderDependencies {
  loadAuthoritative(execution: ResolvedKernelExecution): Promise<Record<string, unknown>>;
  loadDerivedMemory(execution: ResolvedKernelExecution): Promise<Record<string, unknown>>;
  sourceIds?(execution: ResolvedKernelExecution): readonly string[];
}

export function createKernelContextLoader(dependencies: KernelContextLoaderDependencies) {
  return async (execution: ResolvedKernelExecution): Promise<KernelContextBundle> => {
    const [authoritative, derivedMemory] = await Promise.all([
      dependencies.loadAuthoritative(execution),
      dependencies.loadDerivedMemory(execution),
    ]);

    return {
      authoritative,
      derivedMemory,
      sources: [...(dependencies.sourceIds?.(execution) ?? [`crm:${execution.trigger.sourceId}`])],
    };
  };
}

export interface KernelSkillLoaderDependencies {
  load(execution: ResolvedKernelExecution, context: KernelContextBundle): Promise<KernelSkillBundle>;
}

export function createKernelSkillLoader(dependencies: KernelSkillLoaderDependencies) {
  return async (
    execution: ResolvedKernelExecution,
    context: KernelContextBundle,
  ): Promise<KernelSkillBundle> => dependencies.load(execution, context);
}
