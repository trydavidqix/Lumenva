import {
  certifyAgentDefinition,
  type AgentBirthContext,
  type AgentDefinition,
  type AgentDefinitionApproval,
  type AgentDefinitionOrigin,
} from "./agent-definition";
import type { AgentBirthAuthorityStore } from "./agent-birth-authority-store";

function cloneDefinition(definition: AgentDefinition): AgentDefinition {
  return { ...definition, boundaries: [...definition.boundaries] };
}

export type AgentDefinitionRegistration = {
  definition: unknown;
  origin: AgentDefinitionOrigin;
  expectedTenantId: string;
  approval?: AgentDefinitionApproval;
  authorityStore: AgentBirthAuthorityStore;
};

export type StoredAgentDefinitionRegistration = {
  definition: AgentDefinition;
  origin: AgentDefinitionOrigin;
  approval: AgentDefinitionApproval;
};

export class AgentDefinitionRegistry {
  private readonly definitions = new Map<string, Map<string, StoredAgentDefinitionRegistration>>();

  async register(input: AgentDefinitionRegistration): Promise<void> {
    if (input.origin.tenant_id !== input.expectedTenantId) throw new Error("origin_tenant_mismatch");
    const authority = await input.authorityStore.verify({
      tenantId: input.expectedTenantId,
      definitionId: typeof input.definition === "object" && input.definition !== null && "id" in input.definition ? String((input.definition as { id?: unknown }).id) : "",
      definitionVersion: typeof input.definition === "object" && input.definition !== null && "version" in input.definition ? String((input.definition as { version?: unknown }).version) : "",
      origin: input.origin,
      approvalId: input.approval?.approval_id ?? "",
      approverId: input.approval?.approver_id ?? "",
    });
    const certification = certifyAgentDefinition(input.definition, {
      origin: authority.origin,
      expected_tenant_id: input.expectedTenantId,
      approval: authority.approval,
    } satisfies AgentBirthContext);
    if (!certification.ok) {
      throw new Error(`agent_definition_registration_rejected:${certification.errors.join(",")}`);
    }
    const approval = authority.approval as AgentDefinitionApproval;
    const definition = certification.definition;
    const tenantDefinitions = this.definitions.get(input.expectedTenantId) ?? new Map<string, StoredAgentDefinitionRegistration>();
    const key = `${definition.id}:${definition.version}`;
    if (tenantDefinitions.has(key)) throw new Error("agent_definition_duplicate");

    tenantDefinitions.set(key, {
      definition: cloneDefinition(definition),
      origin: { ...authority.origin },
      approval: { ...approval },
    });
    this.definitions.set(input.expectedTenantId, tenantDefinitions);
  }

  get(tenantId: string, id: string, version: string): AgentDefinition | null {
    const registration = this.definitions.get(tenantId)?.get(`${id}:${version}`);
    return registration ? cloneDefinition(registration.definition) : null;
  }

  getRegistration(
    tenantId: string,
    id: string,
    version: string,
  ): StoredAgentDefinitionRegistration | null {
    const registration = this.definitions.get(tenantId)?.get(`${id}:${version}`);
    return registration
      ? {
          definition: cloneDefinition(registration.definition),
          origin: { ...registration.origin },
          approval: { ...registration.approval },
        }
      : null;
  }
}
