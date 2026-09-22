import { createHash } from "node:crypto";

export type ToolDefinition = {
  name: string;
  domain: string;
  capabilities: string[];
  description: string;
};

export type ToolCatalog = {
  tools: ToolDefinition[];
  exposedCount: number;
  omittedCount: number;
  catalogVersion: string;
};

export class ToolRegistry {
  private readonly definitions: ToolDefinition[];

  constructor(definitions: ToolDefinition[]) {
    this.definitions = definitions.map((tool) => ({ ...tool, capabilities: [...tool.capabilities].sort() }));
  }

  resolve(input: { capabilities: string[]; domains?: string[]; maxDefinitions?: number }): ToolCatalog {
    const requested = new Set(input.capabilities);
    const domains = input.domains ? new Set(input.domains) : null;
    const maxDefinitions = Math.max(0, Math.floor(input.maxDefinitions ?? Number.POSITIVE_INFINITY));
    const matching = requested.size === 0
      ? []
      : this.definitions
        .filter((tool) => (!domains || domains.has(tool.domain)) && tool.capabilities.some((capability) => requested.has(capability)))
        .sort((left, right) => left.name.localeCompare(right.name));
    const tools = matching.slice(0, maxDefinitions);
    const canonical = JSON.stringify(tools);
    return {
      tools,
      exposedCount: tools.length,
      omittedCount: Math.max(0, matching.length - tools.length),
      catalogVersion: createHash("sha256").update(canonical).digest("hex"),
    };
  }
}
