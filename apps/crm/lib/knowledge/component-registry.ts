export type ComponentKind = 'component' | 'skill' | 'agent';

export interface ComponentDefinition {
  name: string;
  kind: ComponentKind;
  version: string;
}

/** Registry policy: trim, Unicode NFKC compatibility-normalize, then lowercase. */
const registryKey = (name: string): string => name.trim().normalize('NFKC').toLowerCase();

/** Central catalog enforcing one namespace across components, skills and agents. */
export class ComponentRegistry {
  private readonly entries = new Map<string, ComponentDefinition>();

  register(definition: ComponentDefinition): void {
    const name = definition.name.trim();
    const key = registryKey(name);
    if (name.length === 0) throw new Error('component name is required');
    if (this.entries.has(key)) throw new Error(`component name already registered: ${name}`);
    this.entries.set(key, { ...definition, name });
  }

  get(name: string): ComponentDefinition | undefined {
    return this.entries.get(registryKey(name));
  }
}
