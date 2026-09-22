export interface ToolDescriptor {
  id: string;
  capabilities: string[];
  risk: 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
  schema_token_estimate: number;
  enabled: boolean;
}

export class LazyToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();

  register(tool: ToolDescriptor): void { this.tools.set(tool.id, tool); }

  resolve(capabilities: string[], tokenBudget: number): ToolDescriptor[] {
    let used = 0;
    return [...this.tools.values()]
      .filter((tool) => tool.enabled && capabilities.some((capability) => tool.capabilities.includes(capability)))
      .sort((a, b) => a.schema_token_estimate - b.schema_token_estimate)
      .filter((tool) => {
        if (used + tool.schema_token_estimate > tokenBudget) return false;
        used += tool.schema_token_estimate;
        return true;
      });
  }
}
