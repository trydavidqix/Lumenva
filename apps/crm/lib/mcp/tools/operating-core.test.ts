import { describe, expect, it, vi } from "vitest";
import { crmListAgents, crmListApprovals, crmListJobs } from "./operating-core";

const organizationId = "11111111-1111-4111-8111-111111111111";
const context = {
  organizationId,
  role: "manager" as const,
  actor: { type: "user" as const, id: "22222222-2222-4222-8222-222222222222" },
  apiTokenId: "token",
  requestId: "request",
  supabase: undefined as never,
};

function queryResult(rows: unknown[] = []) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return query;
}

describe("Wave 1 MCP operating-core contract", () => {
  it("exposes ai-operator/read metadata for agents, jobs and approvals", () => {
    for (const tool of [crmListAgents, crmListJobs, crmListApprovals]) {
      expect(tool.category).toBe("read");
      expect(tool.requiresRole).toBe("ai_operator");
      expect(tool.requiresScope).toBe("mcp:read");
      expect(tool.name).toMatch(/^crm_list_(agents|jobs|approvals)$/);
    }
  });

  it("keeps every query tenant-scoped and omits job payload", async () => {
    const query = queryResult([{ id: "job-1", organization_id: organizationId }]);
    const ctx = { ...context, supabase: { from: vi.fn(() => query) } } as never;

    const result = await crmListJobs.handler({ status: undefined, limit: 10 }, ctx);
    expect(query.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(result).toEqual({ jobs: [{ id: "job-1", organization_id: organizationId }] });
  });

  it("applies status filters without bypassing tenant scope", async () => {
    const query = queryResult();
    const ctx = { ...context, supabase: { from: vi.fn(() => query) } } as never;

    await crmListApprovals.handler({ status: "pending", limit: 5 }, ctx);
    expect(query.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(query.eq).toHaveBeenCalledWith("status", "pending");
  });
});
