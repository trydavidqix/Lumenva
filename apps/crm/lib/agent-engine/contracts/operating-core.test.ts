import { describe, expect, it } from "vitest";
import { createEvidenceItem, verifyEvidenceTenant } from "@/lib/agent-engine/contracts/evidence";
import { evaluateToolPolicy } from "@/lib/agent-engine/policies/engine";
import { createApprovalRequest, decideApprovalRequest, enforceApprovalDecision, type ApprovalRequest, type ApprovalStore } from "@/lib/agent-engine/policies/approval";

const tool = {
  id: "send_message",
  owner: "test",
  source: "internal" as const,
  schema: { kind: "inline" as const, value: {} },
  risk: "r2_external_communication" as const,
  hasSideEffect: true,
  idempotencyRequired: true,
  timeoutMs: 1000,
  maxRetries: 1,
};

function memoryStore(): ApprovalStore {
  const rows = new Map<string, ApprovalRequest>();
  return { save: async (row) => void rows.set(row.id, row), load: async (id) => rows.get(id) ?? null };
}

describe("Wave 1 evidence, policy and approval foundations", () => {
  it("creates hashed evidence and enforces tenant boundary", () => {
    const item = createEvidenceItem({ id: "ev-1", organizationId: "org-a", claim: "job complete", source: "unit", createdAt: "2026-09-11T00:00:00Z" });
    expect(item.contentHash).toHaveLength(64);
    expect(verifyEvidenceTenant(item, "org-a")).toBe(true);
    expect(verifyEvidenceTenant(item, "org-b")).toBe(false);
  });

  it("requires approval for external communication", () => {
    expect(evaluateToolPolicy({ organizationId: "org-a", agentId: "agent-a", autonomyLevel: "autopilot_low_risk", tool })).toEqual({ kind: "require_approval", reason: "autonomy_level_requires_approval", approvalType: "external_communication" });
  });

  it("allows one tenant-scoped approval decision and executes once", async () => {
    const store = memoryStore();
    const request = await createApprovalRequest(store, { organizationId: "org-a", runId: "run-1", agentId: "agent-a", toolId: tool.id, approvalType: "tool_execution", idempotencyKey: "idem-1", reason: "test" });
    await expect(decideApprovalRequest(store, request.id, { decision: "approved", decidedBy: "user-1" }, { organizationId: "org-b" })).rejects.toThrow("approval_tenant_mismatch");
    await decideApprovalRequest(store, request.id, { decision: "approved", decidedBy: "user-1" }, { organizationId: "org-a" });
    const execute = async () => enforceApprovalDecision(store, request.id, async () => "ok", { organizationId: "org-a" });
    await expect(execute()).resolves.toEqual({ kind: "executed", result: "ok" });
  });
});
