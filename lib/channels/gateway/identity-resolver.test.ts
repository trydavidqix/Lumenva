import { describe, expect, it, vi } from "vitest";

import {
  normalizeExternalIdentity,
  resolveCustomerIdentity,
  type IdentityRepository,
} from "./identity-resolver";

function repositoryWith(matches: Awaited<ReturnType<IdentityRepository["findExact"]>>) {
  return {
    findExact: vi.fn(async () => matches),
  } satisfies IdentityRepository;
}

describe("identity resolver", () => {
  it("normalizes WhatsApp ids without trusting profile names", () => {
    expect(
      normalizeExternalIdentity({ kind: "whatsapp", value: "+351 911 111 111@s.whatsapp.net" }),
    ).toEqual(["phone:+351911111111", "+351911111111"]);
  });

  it("reuses the conservative Brazilian ninth-digit lookup variants", () => {
    expect(normalizeExternalIdentity({ kind: "phone", value: "+55 31 99896-6398" })).toEqual([
      "+5531998966398",
      "+553198966398",
    ]);
  });

  it("passes trusted tenant/account scope into exact repository lookup", async () => {
    const repository = repositoryWith([
      { customerId: "customer-1", matchedIdentity: "+351911111111" },
    ]);

    await expect(
      resolveCustomerIdentity(
        {
          organizationId: "org-a",
          channel: "whatsapp",
          accountId: "account-a",
          externalIdentity: { kind: "phone", value: "+351 911 111 111" },
        },
        repository,
      ),
    ).resolves.toEqual({
      customerId: "customer-1",
      confidence: "exact",
      matchedIdentity: "+351911111111",
    });

    expect(repository.findExact).toHaveBeenCalledWith({
      organizationId: "org-a",
      channel: "whatsapp",
      accountId: "account-a",
      kind: "phone",
      candidates: ["+351911111111"],
    });
  });

  it("fails closed when the same external identity maps to more than one customer", async () => {
    const repository = repositoryWith([
      { customerId: "customer-1", matchedIdentity: "+351911111111" },
      { customerId: "customer-2", matchedIdentity: "+351911111111" },
    ]);

    await expect(
      resolveCustomerIdentity(
        {
          organizationId: "org-a",
          channel: "whatsapp",
          accountId: "account-a",
          externalIdentity: { kind: "phone", value: "+351911111111" },
        },
        repository,
      ),
    ).resolves.toEqual({
      customerId: null,
      confidence: "unresolved",
      reason: "ambiguous",
    });
  });

  it("does not invent matches for unknown opaque Instagram identities", async () => {
    const repository = repositoryWith([]);

    await expect(
      resolveCustomerIdentity(
        {
          organizationId: "org-a",
          channel: "instagram",
          accountId: "ig-account-a",
          externalIdentity: { kind: "instagram", value: "17841400000000000" },
        },
        repository,
      ),
    ).resolves.toEqual({
      customerId: null,
      confidence: "unresolved",
      reason: "not_found",
    });
  });

  it("rejects empty identities before querying storage", async () => {
    const repository = repositoryWith([]);

    await expect(
      resolveCustomerIdentity(
        {
          organizationId: "org-a",
          channel: "messenger",
          accountId: "page-a",
          externalIdentity: { kind: "messenger", value: "   " },
        },
        repository,
      ),
    ).resolves.toEqual({
      customerId: null,
      confidence: "unresolved",
      reason: "invalid_identity",
    });

    expect(repository.findExact).not.toHaveBeenCalled();
  });
});
