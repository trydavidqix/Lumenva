import { describe, expect, it, vi } from "vitest";

import type { PrepareSimulationInput } from "../contracts/scenario";
import { OasisSimulationEngine } from "./oasis-simulation-engine";

const prepareInput: PrepareSimulationInput = {
  organizationId: "org-a",
  scenario: {
    scenarioId: "scenario-a",
    organizationId: "org-a",
    compilerVersion: "compiler@1",
    question: "Should price change?",
    evidence: [
      {
        id: "evidence-a",
        organizationId: "org-a",
        scenarioId: "scenario-a",
        sourceKind: "observed_fact",
        authority: "authoritative_crm",
        sourceType: "crm",
        sourceRef: "aggregate:sales",
        retrievedAt: "2026-09-13T00:00:00.000Z",
        content: { forbiddenRawPii: "person@example.test" },
        provenance: {},
      },
    ],
    assumptions: [],
    strategies: [],
    actorTemplates: [],
    entities: [],
    parameters: {},
    compiledAt: "2026-09-13T00:00:00.000Z",
  },
  population: {
    id: "population-a",
    organizationId: "org-a",
    scenarioId: "scenario-a",
    version: 1,
    seed: 42,
    size: 1,
    generatorVersion: "population@1",
    actors: [
      {
        id: "synthetic:1",
        synthetic: true,
        scenarioId: "scenario-a",
        populationId: "population-a",
        actorTemplateId: "template-a",
        seed: 42,
        generatorVersion: "population@1",
        traits: { segment: "smb" },
        evidenceRefs: ["evidence-a"],
        createdAt: "2026-09-13T00:00:00.000Z",
      },
    ],
    config: {},
  },
  strategy: {
    id: "strategy-a",
    organizationId: "org-a",
    scenarioId: "scenario-a",
    name: "baseline",
    description: "baseline",
    parameters: { price: 49 },
    isBaseline: true,
    source: "user",
    evidenceRefs: ["evidence-a"],
  },
  seed: 42,
  rounds: 8,
};

describe("OasisSimulationEngine", () => {
  it("does not send raw evidence content or tenant credentials to the worker", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        preparationId: "prep-a",
        engine: "oasis",
        engineVersion: "camel-oasis",
        sanitizedPayloadHash: "hash-a",
      }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const engine = new OasisSimulationEngine({
      baseUrl: "http://worker.internal",
      mode: "on",
      fetchImpl,
    });

    await engine.prepare(prepareInput);

    const [, request] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = String(request.body);
    expect(body).not.toContain("person@example.test");
    expect(body).not.toContain("service_role");
    expect(body).toContain("evidence-a");
    expect(body).toContain("synthetic:1");
  });

  it("fails closed when the external engine is off", async () => {
    const engine = new OasisSimulationEngine({
      baseUrl: "http://worker.internal",
      mode: "off",
      fetchImpl: vi.fn(),
    });
    await expect(engine.prepare(prepareInput)).rejects.toThrow(/disabled/i);
  });
});
