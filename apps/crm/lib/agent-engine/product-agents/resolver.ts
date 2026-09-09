import type { AgentKernelInput, ResolvedKernelAgent } from '../kernel/contracts';
import { isProductAgentId } from './contracts';
import { getProductAgentDefinition } from './definitions';

export interface ProductAgentBinding {
  organizationId: string;
  agentId: string;
  version: string;
  enabled: boolean;
}

export type ProductAgentBindingResolver = (
  input: AgentKernelInput,
) => Promise<ProductAgentBinding | null>;

export function createProductAgentResolver(
  resolveBinding: ProductAgentBindingResolver,
): (input: AgentKernelInput) => Promise<ResolvedKernelAgent | null> {
  return async (input) => {
    if (!isProductAgentId(input.agentId)) return null;

    const binding = await resolveBinding(input);
    if (binding === null || binding.agentId !== input.agentId) return null;

    const definition = getProductAgentDefinition(input.agentId);
    if (definition === null || binding.version !== definition.version) return null;

    return {
      organizationId: binding.organizationId,
      enabled: binding.enabled,
      definition,
    };
  };
}
