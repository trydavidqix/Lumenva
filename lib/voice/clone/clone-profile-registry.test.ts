import { describe, expect, it, vi } from "vitest";
import {
  assertCloneProfileUsable,
  isCloneProfileUsable,
  type CloneProfileLookup,
  type CloneProfileRecord,
} from "./clone-profile-registry";

function lookupReturning(record: CloneProfileRecord | null): CloneProfileLookup {
  return { findCloneProfile: vi.fn().mockResolvedValue(record) };
}

describe("clone profile usability (Fase 6 — perfil revogado / outro tenant)", () => {
  it("accepts an active clone profile owned by the requesting organization", async () => {
    const lookup = lookupReturning({ cloneProfileId: "clone-1", organizationId: "org-1", status: "active" });
    await expect(assertCloneProfileUsable(lookup, "org-1", "clone-1")).resolves.toBeUndefined();
    expect(await isCloneProfileUsable(lookup, "org-1", "clone-1")).toBe(true);
  });

  it("rejects an unknown clone profile — 'voz inexistente é rejeitada'", async () => {
    const lookup = lookupReturning(null);
    await expect(assertCloneProfileUsable(lookup, "org-1", "clone-ghost")).rejects.toThrow(/unknown/);
    expect(await isCloneProfileUsable(lookup, "org-1", "clone-ghost")).toBe(false);
  });

  it("rejects a clone profile owned by a different organization — 'voz de outro tenant é rejeitada'", async () => {
    const lookup = lookupReturning({ cloneProfileId: "clone-1", organizationId: "org-2", status: "active" });
    await expect(assertCloneProfileUsable(lookup, "org-1", "clone-1")).rejects.toThrow(/different organization/);
    expect(await isCloneProfileUsable(lookup, "org-1", "clone-1")).toBe(false);
  });

  it("rejects a revoked clone profile even for its own organization — 'perfil revogado não pode ser usado'", async () => {
    const lookup = lookupReturning({ cloneProfileId: "clone-1", organizationId: "org-1", status: "revoked" });
    await expect(assertCloneProfileUsable(lookup, "org-1", "clone-1")).rejects.toThrow(/revoked/);
    expect(await isCloneProfileUsable(lookup, "org-1", "clone-1")).toBe(false);
  });
});
