import type { AgentKernelInput, ResolvedKernelAgent, ResolvedKernelExecution } from "./contracts";

export type KernelResolutionResult =
  | { kind: "blocked"; reason: "agent_not_found" | "tenant_mismatch" | "agent_disabled" | "invalid_agent_version" }
  | { kind: "resolved"; agent: ResolvedKernelAgent; execution: ResolvedKernelExecution };

export interface KernelResolutionDependencies {
  resolveAgent(input: AgentKernelInput): Promise<ResolvedKernelAgent | null>;
  createIdentity(input: AgentKernelInput, agent: ResolvedKernelAgent): Promise<ResolvedKernelExecution>;
}

export async function resolveKernelExecution(
  input: AgentKernelInput,
  dependencies: KernelResolutionDependencies,
): Promise<KernelResolutionResult> {
  const agent = await dependencies.resolveAgent(input);
  if (agent === null) return { kind: "blocked", reason: "agent_not_found" };
  if (agent.organizationId !== input.organizationId) return { kind: "blocked", reason: "tenant_mismatch" };
  if (!agent.enabled) return { kind: "blocked", reason: "agent_disabled" };
  if (!agent.definition.version.trim()) return { kind: "blocked", reason: "invalid_agent_version" };

  const execution = await dependencies.createIdentity(input, agent);
  if (execution.organizationId !== input.organizationId || execution.agentId !== agent.definition.id) {
    return { kind: "blocked", reason: "tenant_mismatch" };
  }
  if (!execution.agentVersion.trim()) return { kind: "blocked", reason: "invalid_agent_version" };

  return { kind: "resolved", agent, execution };
}
