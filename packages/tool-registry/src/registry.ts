export const TOOL_RISKS = ["R0","R1","R2","R3","R4"] as const;
export type ToolRisk = (typeof TOOL_RISKS)[number];
export type SideEffects = "none" | "reversible_internal" | "external_comm" | "production" | "financial" | "destructive";
export interface ToolDefinition { name: string; version: string; description: string; inputSchema: object; outputSchema: object; readOrWrite: "read" | "write"; riskLevel: ToolRisk; idempotent: boolean; requiresIdempotencyKey: boolean; sideEffects: SideEffects; authorizationScope: readonly string[]; timeoutMs: number; capabilityTags: readonly string[]; provider: string; }
export interface ToolPolicy { allowedCapabilities: readonly string[]; maxRisk: ToolRisk; maxToolsPerTurn: number; }
export type ToolRegistry = ReadonlyMap<string, ToolDefinition>;
const riskRank = (risk: ToolRisk): number => TOOL_RISKS.indexOf(risk);
export function createToolRegistry(tools: readonly ToolDefinition[]): ToolRegistry {
  const result = new Map<string, ToolDefinition>();
  for (const tool of tools) {
    if (!tool.name.trim() || !tool.version.trim() || result.has(tool.name)) throw new Error("E_DUPLICATE_TOOL");
    if (tool.readOrWrite === "write" && !tool.requiresIdempotencyKey && tool.sideEffects !== "none") throw new Error("E_WRITE_IDEMPOTENCY_REQUIRED");
    result.set(tool.name, tool);
  }
  return result;
}
export function searchTools(registry: ToolRegistry, query: string, input: { maxResults: number }): ToolDefinition[] {
  const normalized = query.trim().toLowerCase();
  return [...registry.values()].map((tool) => {
    const fields = [tool.name, tool.description, ...tool.capabilityTags].map((v) => v.toLowerCase());
    const exact = tool.capabilityTags.some((tag) => tag === normalized) ? 3 : 0;
    const match = fields.some((field) => field.includes(normalized)) ? 1 : 0;
    return { tool, score: exact + match };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name)).slice(0, Math.max(0, input.maxResults)).map((item) => item.tool);
}
export function filterToolsForAgent(tools: readonly ToolDefinition[], policy: ToolPolicy): ToolDefinition[] {
  const capabilities = new Set(policy.allowedCapabilities);
  return tools.filter((tool) => riskRank(tool.riskLevel) <= riskRank(policy.maxRisk) && tool.authorizationScope.every((scope) => capabilities.has(scope))).slice(0, Math.max(0, policy.maxToolsPerTurn));
}
export function assertToolOffered(name: string, offered: readonly ToolDefinition[]): ToolDefinition {
  const tool = offered.find((candidate) => candidate.name === name);
  if (!tool) throw new Error("E_TOOL_NOT_OFFERED");
  return tool;
}
