export type ComponentKind = 'component' | 'skill' | 'agent';

export interface ComponentDefinition {
  name: string;
  kind: ComponentKind;
  version: string;
}

/** Central catalog enforcing one namespace across components, skills and agents. */
export class ComponentRegistry {
  private readonly entries = new Map<string, ComponentDefinition>();

  register(definition: ComponentDefinition): void {
    const name = definition.name.trim();
    if (name.length === 0) throw new Error('component name is required');
    if (this.entries.has(name)) throw new Error(`component name already registered: ${name}`);
    this.entries.set(name, { ...definition, name });
  }

  get(name: string): ComponentDefinition | undefined {
    return this.entries.get(name.trim());
  }
}
