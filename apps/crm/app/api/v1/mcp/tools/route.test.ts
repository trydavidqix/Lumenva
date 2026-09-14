import { describe, expect, it, vi } from "vitest";

const { loadAuthUser, resolveActiveOrg } = vi.hoisted(() => ({
  loadAuthUser: vi.fn(),
  resolveActiveOrg: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ loadAuthUser, resolveActiveOrg }));

import { GET } from "@/app/api/v1/mcp/tools/route";
import { allTools } from "@/lib/mcp/tools";

describe("MCP HTTP catalog runtime", () => {
  it("serves the same tool registry used by CLI/MCP handlers", async () => {
    loadAuthUser.mockResolvedValue({ id: "user-1" });
    resolveActiveOrg.mockResolvedValue({ id: "org-1" });

    const response = await GET({} as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    const served = body.data.tools as Array<{ id: string; input_schema: unknown }>;

    expect(served.map((tool) => tool.id).sort()).toEqual(allTools.map((tool) => tool.name).sort());
    expect(served.find((tool) => tool.id === "crm_list_improvement_proposals")?.input_schema).toBeDefined();
  });
});
