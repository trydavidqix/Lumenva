import { describe, expect, it } from "vitest";

import type { ScenarioEvidenceItem } from "../contracts/scenario";
import { buildEvidencePack } from "./evidence-pack";

const item = (overrides: Partial<ScenarioEvidenceItem>): ScenarioEvidenceItem => ({
  id: overrides.id ?? "evidence",
  organizationId: overrides.organizationId ?? "org-a",
  scenarioId: overrides.scenarioId ?? "scenario-a",
  sourceKind: overrides.sourceKind ?? "observed_fact",
  authority: overrides.authority ?? "authoritative_crm",
  sourceType: overrides.sourceType ?? "crm",
  sourceRef: overrides.sourceRef ?? "lead:1",
  retrievedAt: overrides.retrievedAt ?? "2026-09-01T00:00:00.000Z",
  observedAt: overrides.observedAt,
  content: overrides.content ?? {},
  provenance: overrides.provenance ?? {},
});

describe("buildEvidencePack", () => {
  it("orders stronger authority before weaker context", () => {
    const pack = buildEvidencePack([
      item({ id: "model", authority: "model_prior" }),
      item({ id: "graph", authority: "derived_memory" }),
      item({ id: "crm", authority: "authoritative_crm" }),
      item({ id: "knowledge", authority: "published_knowledge" }),
    ]);

    expect(pack.items.map((entry) => entry.id)).toEqual(["crm", "knowledge", "graph", "model"]);
  });

  it("enforces historical cutoffs for backtesting", () => {
    const pack = buildEvidencePack(
      [
        item({ id: "before", observedAt: "2026-08-01T00:00:00.000Z" }),
        item({ id: "after", observedAt: "2026-10-01T00:00:00.000Z" }),
      ],
      { cutoffAt: "2026-09-01T00:00:00.000Z" },
    );

    expect(pack.items.map((entry) => entry.id)).toEqual(["before"]);
    expect(pack.excludedRefs).toEqual(["after"]);
  });

  it("never mixes organizations", () => {
    expect(() =>
      buildEvidencePack([
        item({ id: "a", organizationId: "org-a" }),
        item({ id: "b", organizationId: "org-b" }),
      ]),
    ).toThrow(/multiple organizations/i);
  });
});
