import { describe, expect, it } from "vitest";

import { collectContext } from "./provider";
import type { ContextProvider } from "./provider";

const request = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  contactId: "00000000-0000-4000-8000-000000000002",
  conversationId: "00000000-0000-4000-8000-000000000003",
  agentId: "00000000-0000-4000-8000-000000000004",
  query: "contexto",
  now: "2026-08-11T10:00:00.000Z",
};

describe("collectContext", () => {
  it("keeps null/local/Mem0 provider results separated and never promotes shadow items", async () => {
    const local: ContextProvider = {
      name: "native-crm",
      retrieve: async () => ({ provider: "native-crm", items: [{
        id: "note-1", provider: "native-crm", authorityDomain: "operational_state", authorityLevel: 80,
        confidence: 1, occurredAt: null, expiresAt: null, risk: "low", sourceId: "note-1", text: "Local",
      }], degraded: false, influencePrompt: true, bucket: "candidate", shadowItems: [] }),
    };
    const mem0: ContextProvider = {
      name: "mem0",
      retrieve: async () => ({ provider: "mem0", items: [], shadowItems: [{
        id: "memory-1", provider: "mem0", authorityDomain: "customer_preference", authorityLevel: 40,
        confidence: 0.8, occurredAt: null, expiresAt: null, risk: "low", sourceId: "message-1", text: "Shadow",
      }], degraded: false, influencePrompt: false, bucket: "shadow" }),
    };

    const result = await collectContext({ providers: [local, mem0], request });

    expect(result.items.map((item) => item.id)).toEqual(["note-1"]);
    expect(result.shadowItems.map((item) => item.id)).toEqual(["memory-1"]);
  });

  it("turns one provider failure into a degraded result without losing local context", async () => {
    const local: ContextProvider = {
      name: "native-crm",
      retrieve: async () => ({ provider: "native-crm", items: [], shadowItems: [], degraded: false, influencePrompt: true, bucket: "candidate" }),
    };
    const failing: ContextProvider = { name: "mem0", retrieve: async () => { throw new Error("unavailable"); } };

    const result = await collectContext({ providers: [local, failing], request });

    expect(result.degraded).toBe(true);
    expect(result.results).toEqual(expect.arrayContaining([expect.objectContaining({ provider: "mem0", degraded: true, items: [] })]));
  });
});
