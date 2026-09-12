import type { AgentDefinition } from "./agent-definition";

function cloneDefinition(definition: AgentDefinition): AgentDefinition {
  return {
    ...definition,
    boundaries: [...definition.boundaries],
  };
}

export class AgentDefinitionRegistry {
  private readonly definitions = new Map<string, Map<string, AgentDefinition>>();

  register(definition: AgentDefinition): void {
    if (definition.status !== "CERTIFIED") {
      throw new Error("agent_definition_not_certified");
    }

    const versions = this.definitions.get(definition.id) ?? new Map<string, AgentDefinition>();
    if (versions.has(definition.version)) {
      throw new Error("agent_definition_duplicate");
    }

    versions.set(definition.version, cloneDefinition(definition));
    this.definitions.set(definition.id, versions);
  }

  get(id: string, version: string): AgentDefinition | null {
    const definition = this.definitions.get(id)?.get(version);
    return definition ? cloneDefinition(definition) : null;
  }
}
