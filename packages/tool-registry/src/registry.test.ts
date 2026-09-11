import { describe, expect, it } from "vitest";
import { assertToolOffered, createToolRegistry, filterToolsForAgent, searchTools, type ToolDefinition } from "./registry";
const tools: ToolDefinition[] = [
  { name: "calendar.book", version: "tool_2026.09.11_001", description: "book a meeting", inputSchema: {}, outputSchema: {}, readOrWrite: "write", riskLevel: "R1", idempotent: true, requiresIdempotencyKey: true, sideEffects: "reversible_internal", authorizationScope: ["calendar.write"], timeoutMs: 10000, capabilityTags: ["calendar", "meeting"], provider: "internal" },
  { name: "payment.refund", version: "tool_2026.09.11_001", description: "refund payment", inputSchema: {}, outputSchema: {}, readOrWrite: "write", riskLevel: "R4", idempotent: false, requiresIdempotencyKey: true, sideEffects: "financial", authorizationScope: ["payment.write"], timeoutMs: 10000, capabilityTags: ["payment", "refund"], provider: "internal" },
];
describe("Tool Registry and guardrails", () => {
  it("searches tags and filters unauthorized or over-risk tools", () => {
    const registry = createToolRegistry(tools);
    const candidates = searchTools(registry, "book a meeting", { maxResults: 4 });
    expect(candidates[0]?.name).toBe("calendar.book");
    expect(filterToolsForAgent(candidates, { allowedCapabilities: ["calendar.write"], maxRisk: "R3", maxToolsPerTurn: 2 }).map((tool) => tool.name)).toEqual(["calendar.book"]);
  });
  it("rechecks offer and authority at execution boundary", () => {
    expect(() => assertToolOffered("payment.refund", [tools[0]!])).toThrow("E_TOOL_NOT_OFFERED");
    expect(() => assertToolOffered("calendar.book", [tools[0]!])).not.toThrow();
  });
});