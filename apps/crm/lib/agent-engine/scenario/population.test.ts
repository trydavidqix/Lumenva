import { describe, expect, it } from "vitest";

import { buildSyntheticPopulation } from "./population";

const template = {
  id: "template-a",
  organizationId: "org-a",
  scenarioId: "scenario-a",
  key: "smb",
  label: "SMB buyers",
  weight: 1,
  traits: { priceSensitivity: 0.7, crmContactId: "must-not-copy" },
  incentives: { saveMoney: true },
  constraints: {},
  evidenceRefs: ["evidence-a"],
};

describe("buildSyntheticPopulation", () => {
  it("is deterministic for the same seed", () => {
    const a = buildSyntheticPopulation({
      organizationId: "org-a",
      scenarioId: "scenario-a",
      populationId: "population-a",
      version: 1,
      seed: 42,
      size: 24,
      generatorVersion: "population@1",
      templates: [template],
      now: "2026-09-13T00:00:00.000Z",
    });
    const b = buildSyntheticPopulation({
      organizationId: "org-a",
      scenarioId: "scenario-a",
      populationId: "population-a",
      version: 1,
      seed: 42,
      size: 24,
      generatorVersion: "population@1",
      templates: [template],
      now: "2026-09-13T00:00:00.000Z",
    });

    expect(a.actors).toEqual(b.actors);
  });

  it("never copies real CRM identifiers into synthetic actors", () => {
    const population = buildSyntheticPopulation({
      organizationId: "org-a",
      scenarioId: "scenario-a",
      populationId: "population-a",
      version: 1,
      seed: 7,
      size: 24,
      generatorVersion: "population@1",
      templates: [template],
    });

    expect(JSON.stringify(population.actors)).not.toContain("must-not-copy");
    expect(population.actors.every((actor) => actor.synthetic === true)).toBe(true);
  });

  it("enforces MVP population bounds by default", () => {
    expect(() =>
      buildSyntheticPopulation({
        organizationId: "org-a",
        scenarioId: "scenario-a",
        populationId: "population-a",
        version: 1,
        seed: 1,
        size: 10,
        generatorVersion: "population@1",
        templates: [template],
      }),
    ).toThrow(/24.*50/i);
  });
});
