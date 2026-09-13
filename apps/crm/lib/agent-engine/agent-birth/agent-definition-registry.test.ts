import { describe, expect, it } from "vitest";

import type { AgentDefinition, AgentDefinitionApproval } from "./agent-definition";
import { AgentDefinitionRegistry } from "./agent-definition-registry";
import { InMemoryAgentBirthAuthorityStore } from "./agent-birth-authority-store";

const approval: AgentDefinitionApproval = {
  approval_id: "approval-1",
  approver_id: "reviewer-1",
  tenant_id: "tenant-a",
  status: "APPROVED",
  approved_at: "2026-09-13T00:00:00.000Z",
  policy_version: "policy-v1",
};

const certified = (overrides: Partial<AgentDefinition> = {}): AgentDefinition => ({
  id: "sales",
  version: "1.0.0",
  status: "CERTIFIED",
  identity: "Sales agent.",
  mission: "Qualify opportunities.",
  boundaries: ["No unapproved external send."],
  authority: "P0-P2 in the assigned tenant.",
  escalation: "Escalate uncertainty to a human reviewer.",
  ...overrides,
});

function registration(definition: unknown = certified(), overrides: Partial<typeof approval> = {}) {
  const authorityStore = new InMemoryAgentBirthAuthorityStore();
  authorityStore.addActor({ actor_id: "author-1", tenant_id: "tenant-a", actor_type: "HUMAN", active: true });
  authorityStore.addApproval({ ...approval, ...overrides, definition_id: "sales", definition_version: (definition as AgentDefinition).version, author_actor_id: "author-1" });
  return {
    definition,
    origin: { actor_id: "author-1", tenant_id: "tenant-a" },
    expectedTenantId: "tenant-a",
    approval: { ...approval, ...overrides },
    authorityStore,
  };
}

describe("AgentDefinitionRegistry V2", () => {
  it("stores and retrieves only a server-authorized definition by tenant, id and version", async () => {
    const registry = new AgentDefinitionRegistry();
    await registry.register(registration());

    expect(registry.get("tenant-a", "sales", "1.0.0")).toEqual(certified());
    expect(registry.get("tenant-b", "sales", "1.0.0")).toBeNull();
    expect(registry.getRegistration("tenant-a", "sales", "1.0.0")).toMatchObject({
      origin: { actor_id: "author-1", tenant_id: "tenant-a" },
      approval: { approval_id: "approval-1", approver_id: "reviewer-1" },
    });
  });

  it("keeps versions and tenants independently addressable", async () => {
    const registry = new AgentDefinitionRegistry();
    await registry.register(registration(certified({ version: "1.0.0" })));
    await registry.register(registration(certified({ version: "2.0.0", mission: "Qualify and route opportunities." })));
    const tenantB = registration(certified({ version: "1.0.0" }));
    tenantB.authorityStore = new InMemoryAgentBirthAuthorityStore();
    tenantB.authorityStore.addActor({ actor_id: "author-2", tenant_id: "tenant-b", actor_type: "HUMAN", active: true });
    tenantB.authorityStore.addApproval({ ...approval, tenant_id: "tenant-b", author_actor_id: "author-2", definition_id: "sales", definition_version: "1.0.0" });
    await registry.register({
      ...registration(certified({ version: "1.0.0" })),
      origin: { actor_id: "author-2", tenant_id: "tenant-b" },
      expectedTenantId: "tenant-b",
      approval: { ...approval, tenant_id: "tenant-b" },
      authorityStore: tenantB.authorityStore,
    });

    expect(registry.get("tenant-a", "sales", "1.0.0")?.mission).toBe("Qualify opportunities.");
    expect(registry.get("tenant-a", "sales", "2.0.0")?.mission).toBe("Qualify and route opportunities.");
    expect(registry.get("tenant-b", "sales", "1.0.0")).not.toBeNull();
  });

  it.each([
    ["missing approval", { approval: undefined }, "approval_required"],
    ["self approval", { approval: { ...approval, approver_id: "author-1" } }, "approval_independence_required"],
    ["origin tenant mismatch", { origin: { actor_id: "author-1", tenant_id: "tenant-b" } }, "origin_tenant_mismatch"],
  ] as const)("rejects %s and keeps it out of the registry", async (_label, overrides, error) => {
    const registry = new AgentDefinitionRegistry();
    await expect(registry.register({ ...registration(), ...overrides })).rejects.toThrow(error === "approval_independence_required" || error === "approval_required" ? "approval_not_authoritative" : error);
    expect(registry.get("tenant-a", "sales", "1.0.0")).toBeNull();
  });

  it("rejects SHADOW/forged definitions and duplicate tenant/id/version entries", async () => {
    const registry = new AgentDefinitionRegistry();
    await expect(registry.register(registration(certified({ status: "SHADOW" })))).rejects.toThrow("agent_definition_registration_rejected");
    await registry.register(registration());
    await expect(registry.register(registration())).rejects.toThrow("agent_definition_duplicate");
    await expect(registry.register(registration(certified({ mission: "" })))).rejects.toThrow("mission_required");
  });

  it("protects stored definition, origin and approval objects from caller mutation", async () => {
    const registry = new AgentDefinitionRegistry();
    const input = registration();
    await registry.register(input);
    (input.definition as AgentDefinition).boundaries[0] = "mutated caller value";
    input.origin.actor_id = "mutated";
    input.approval!.approver_id = "mutated";

    expect(registry.get("tenant-a", "sales", "1.0.0")?.boundaries).toEqual(["No unapproved external send."]);
    expect(registry.getRegistration("tenant-a", "sales", "1.0.0")).toMatchObject({
      origin: { actor_id: "author-1" },
      approval: { approver_id: "reviewer-1" },
    });
  });
});
