import { describe, expect, it } from "vitest";

import { NullGraphContextPort } from "./port";
import { graphFactSchema } from "./types";
import type { GraphEpisode, GraphFact } from "./types";

const validEpisode: GraphEpisode = {
  organizationId: "org-1",
  sourceId: "event-1",
  sourceVersion: "1",
  name: "whatsapp-message",
  body: "Cliente perguntou sobre prazo de entrega.",
  sourceType: "message",
  sourceDescription: "whatsapp inbound message",
  referenceTime: "2026-08-10T12:00:00Z",
};

describe("NullGraphContextPort", () => {
  it("accepts a canonical episode without retaining it", async () => {
    const port = new NullGraphContextPort();

    await expect(port.addEpisode(validEpisode, "graph:event-1:1")).resolves.toBeUndefined();
  });

  it.each([
    ["empty organization ID", { organizationId: "" }],
    ["empty source ID", { sourceId: "" }],
    ["empty source version", { sourceVersion: "" }],
    ["empty name", { name: "" }],
    ["empty body", { body: "" }],
    ["unsupported source type", { sourceType: "audio" }],
    ["empty source description", { sourceDescription: "" }],
    ["non-ISO reference time", { referenceTime: "yesterday" }],
    ["reference time without offset", { referenceTime: "2026-08-10T12:00:00" }],
  ])("rejects an episode with %s", async (_caseName, overrides) => {
    const port = new NullGraphContextPort();
    const invalidEpisode = { ...validEpisode, ...overrides } as unknown as GraphEpisode;

    await expect(port.addEpisode(invalidEpisode, "graph:event-1:1")).rejects.toThrow();
  });

  it("rejects an empty idempotency key even for an otherwise valid episode", async () => {
    const port = new NullGraphContextPort();

    await expect(port.addEpisode(validEpisode, "")).rejects.toThrow();
  });

  it("never returns a fact, so a caller can never have graph output influence a decision", async () => {
    const port = new NullGraphContextPort();

    await expect(port.search({ organizationId: "org-1", query: "prazo de entrega", limit: 5 })).resolves.toEqual([]);
  });

  it.each([
    ["empty organization ID", { organizationId: "" }],
    ["empty query", { query: "" }],
    ["zero limit", { limit: 0 }],
    ["negative limit", { limit: -1 }],
    ["non-integer limit", { limit: 1.5 }],
  ])("rejects a search input with %s", async (_caseName, overrides) => {
    const port = new NullGraphContextPort();
    const validInput = { organizationId: "org-1", query: "prazo de entrega", limit: 5 };
    const invalidInput = { ...validInput, ...overrides };

    await expect(port.search(invalidInput)).rejects.toThrow();
  });

  it("accepts deleteOrganization for a valid organization ID without retaining state", async () => {
    const port = new NullGraphContextPort();

    await expect(port.deleteOrganization("org-1")).resolves.toBeUndefined();
  });

  it("rejects deleteOrganization for an empty organization ID", async () => {
    const port = new NullGraphContextPort();

    await expect(port.deleteOrganization("")).rejects.toThrow();
  });

  it("reports that the disabled adapter is healthy without claiming provider health", async () => {
    const port = new NullGraphContextPort();

    await expect(port.health()).resolves.toEqual({ ok: true, latencyMs: 0 });
  });
});

const validFact: GraphFact = {
  id: "fact-1",
  text: "Cliente prefere entrega expressa.",
  sourceId: "event-1",
  validFrom: "2026-08-10T12:00:00Z",
  validUntil: null,
  confidence: 0.8,
  authorityDomain: "customer_preference",
  risk: "low",
};

describe("graphFactSchema", () => {
  it("accepts a canonical graph fact with an open-ended validity window", () => {
    expect(graphFactSchema.parse(validFact)).toEqual(validFact);
  });

  it("accepts a fact with both validFrom and validUntil bounded", () => {
    const bounded: GraphFact = { ...validFact, validUntil: "2026-09-01T00:00:00Z" };

    expect(graphFactSchema.parse(bounded)).toEqual(bounded);
  });

  it.each([
    ["empty id", { id: "" }],
    ["empty text", { text: "" }],
    ["empty source ID", { sourceId: "" }],
    ["non-ISO validFrom", { validFrom: "yesterday" }],
    ["non-ISO validUntil", { validUntil: "yesterday" }],
    ["confidence below zero", { confidence: -0.01 }],
    ["confidence above one", { confidence: 1.01 }],
    ["unsupported authority domain", { authorityDomain: "payment_authorization" }],
    ["unsupported risk level", { risk: "critical" }],
  ])("rejects a fact with %s", (_caseName, overrides) => {
    const invalidFact = { ...validFact, ...overrides };

    expect(() => graphFactSchema.parse(invalidFact)).toThrow();
  });

  it("carries the same authorityDomain/risk vocabularies as SemanticMemoryRecord (Mem0)", () => {
    // authorityDomain/risk are the shared closed vocabularies from platform/contracts.ts.
    // A fact marked "high" risk still parses here — schema validity is not a HIGH-risk
    // authorization by itself; that gate lives in the prompt/decision layer, not this port.
    const highRiskFact: GraphFact = { ...validFact, risk: "high", authorityDomain: "legal" };

    expect(graphFactSchema.parse(highRiskFact)).toEqual(highRiskFact);
  });
});
