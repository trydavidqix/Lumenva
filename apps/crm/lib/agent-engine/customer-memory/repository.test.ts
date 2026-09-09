import { describe, expect, it } from "vitest";

import { createCustomerMemoryRepository } from "./repository";
import type { CustomerQuickMemory } from "./types";

function memory(): CustomerQuickMemory {
  return {
    organizationId: "11111111-1111-4111-8111-111111111111",
    contactId: "22222222-2222-4222-8222-222222222222",
    identity: { displayName: "Ana", primaryPhone: "+351910000000" },
    addresses: [],
    preferences: [],
    habitualOrders: [],
    recentOrderRefs: [],
    relationshipSummary: null,
    channelFacts: [],
    importantEvents: [],
    updatedAt: "2026-08-24T12:00:00.000Z",
  };
}

function fakeClient(row: Record<string, unknown> | null = null) {
  const filters: Array<[string, unknown]> = [];
  const writes: Array<{ table: string; payload: unknown; options: unknown }> = [];

  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    },
    maybeSingle: async () => ({ data: row, error: null }),
    upsert: async (payload: unknown, options: unknown) => {
      writes.push({ table: "customer_memory", payload, options });
      return { error: null };
    },
    delete: () => query,
  };

  return {
    filters,
    writes,
    client: {
      from: (table: string) => {
        expect(table).toBe("customer_memory");
        return query;
      },
    },
  };
}

describe("CustomerMemoryRepository", () => {
  it("sempre filtra leitura por organization_id E contact_id", async () => {
    const fake = fakeClient(null);
    const repo = createCustomerMemoryRepository(fake.client as never);

    await repo.getQuickMemory(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );

    expect(fake.filters).toEqual([
      ["organization_id", "11111111-1111-4111-8111-111111111111"],
      ["contact_id", "22222222-2222-4222-8222-222222222222"],
    ]);
  });

  it("upsert grava tenant/contact vindos do contrato e usa conflito composto", async () => {
    const fake = fakeClient();
    const repo = createCustomerMemoryRepository(fake.client as never);

    await repo.upsertQuickMemory(memory());

    expect(fake.writes).toHaveLength(1);
    expect(fake.writes[0]?.payload).toMatchObject({
      organization_id: "11111111-1111-4111-8111-111111111111",
      contact_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(fake.writes[0]?.options).toEqual({ onConflict: "organization_id,contact_id" });
  });

  it("delete também exige ambos os filtros", async () => {
    const fake = fakeClient();
    const repo = createCustomerMemoryRepository(fake.client as never);

    await repo.deleteQuickMemory(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );

    expect(fake.filters).toEqual([
      ["organization_id", "11111111-1111-4111-8111-111111111111"],
      ["contact_id", "22222222-2222-4222-8222-222222222222"],
    ]);
  });
});
