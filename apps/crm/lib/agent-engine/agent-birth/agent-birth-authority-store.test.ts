import { describe, expect, it } from "vitest";
import { InMemoryAgentBirthAuthorityStore, createPostgresAgentBirthAuthorityStore, type TrustedAgentApproval } from "./agent-birth-authority-store";

const actor = { actor_id: "author-1", tenant_id: "tenant-a", actor_type: "HUMAN" as const, active: true };
const approval: TrustedAgentApproval = {
  approval_id: "approval-1", approver_id: "reviewer-1", tenant_id: "tenant-a", status: "APPROVED",
  approved_at: "2026-09-13T00:00:00.000Z", policy_version: "policy-v1", definition_id: "sales", definition_version: "1.0.0", author_actor_id: "author-1",
};

describe("Agent Birth server-side authority", () => {
  it("returns canonical actor and approval records, not caller fields", async () => {
    const store = new InMemoryAgentBirthAuthorityStore();
    store.addActor(actor);
    store.addApproval(approval);
    await expect(store.verify({ tenantId: "tenant-a", definitionId: "sales", definitionVersion: "1.0.0", origin: { actor_id: "author-1", tenant_id: "tenant-a" }, approvalId: "approval-1", approverId: "reviewer-1" })).resolves.toEqual({ origin: actor, approval });
  });

  it("rejects forged tenant, actor or approval references", async () => {
    const store = new InMemoryAgentBirthAuthorityStore();
    store.addActor(actor);
    store.addApproval(approval);
    await expect(store.verify({ tenantId: "tenant-b", definitionId: "sales", definitionVersion: "1.0.0", origin: { actor_id: "author-1", tenant_id: "tenant-b" }, approvalId: "approval-1", approverId: "reviewer-1" })).rejects.toThrow("origin_not_authoritative");
    await expect(store.verify({ tenantId: "tenant-a", definitionId: "sales", definitionVersion: "1.0.0", origin: { actor_id: "forged", tenant_id: "tenant-a" }, approvalId: "approval-1", approverId: "reviewer-1" })).rejects.toThrow("origin_not_authoritative");
    await expect(store.verify({ tenantId: "tenant-a", definitionId: "other", definitionVersion: "1.0.0", origin: actor, approvalId: "approval-1", approverId: "reviewer-1" })).rejects.toThrow("approval_not_authoritative");
  });

  it("uses tenant and actor predicates in the persistent lookup", async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const db = { async query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]) { calls.push({ text, values }); return { rows: (text.includes("agent_birth_actors") ? [actor] : [approval]) as T[] }; } };
    await createPostgresAgentBirthAuthorityStore(db).verify({ tenantId: "tenant-a", definitionId: "sales", definitionVersion: "1.0.0", origin: actor, approvalId: "approval-1", approverId: "reviewer-1" });
    expect(calls[0]?.text).toContain("where tenant_id = $1 and actor_id = $2");
    expect(calls[1]?.text).toContain("and author_actor_id = $5");
    expect(calls[1]?.values).toEqual(["tenant-a", "approval-1", "sales", "1.0.0", "author-1", "reviewer-1"]);
  });
});
