import { describe, expect, it } from "vitest";

import {
  claimEvidenceSchema,
  claimSchema,
  editorialQualityDecisionSchema,
  evidenceSchema,
  qualityGateSchema,
  researchRunSchema,
} from "@/lib/content-os/editorial/contracts";

const ids = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  claimId: "00000000-0000-4000-8000-000000000003",
  evidenceId: "00000000-0000-4000-8000-000000000004",
  contentId: "00000000-0000-4000-8000-000000000005",
};
const now = "2026-09-07T12:00:00Z";

describe("Content OS editorial contracts", () => {
  it("enforces research lifecycle invariants", () => {
    expect(researchRunSchema.safeParse({
      id: ids.runId, organizationId: ids.organizationId, query: "novo agente", status: "running",
      startedAt: now, createdAt: now, updatedAt: now, metadata: {},
    }).success).toBe(true);
    expect(researchRunSchema.safeParse({
      id: ids.runId, organizationId: ids.organizationId, query: "novo agente", status: "running",
      createdAt: now, updatedAt: now,
    }).success).toBe(false);
  });

  it("rejects unsafe source URLs and accepts verified evidence", () => {
    const evidence = { id: ids.evidenceId, organizationId: ids.organizationId, researchRunId: ids.runId,
      sourceUrl: "https://example.com/source", sourceTitle: "Fonte oficial", kind: "official",
      verificationStatus: "confirmed", observedAt: now, createdAt: now, metadata: {}, };
    expect(evidenceSchema.safeParse(evidence).success).toBe(true);
    expect(evidenceSchema.safeParse({ ...evidence, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("requires confidence for reviewed claims and preserves claim-evidence relation", () => {
    const claim = { id: ids.claimId, organizationId: ids.organizationId, researchRunId: ids.runId,
      statement: "O produto foi lançado", importance: "critical", status: "confirmed", confidence: 0.95,
      createdAt: now, updatedAt: now };
    expect(claimSchema.safeParse(claim).success).toBe(true);
    expect(claimSchema.safeParse({ ...claim, confidence: undefined }).success).toBe(false);
    expect(claimEvidenceSchema.safeParse({ id: ids.contentId, organizationId: ids.organizationId,
      claimId: ids.claimId, evidenceId: ids.evidenceId, relation: "supports", createdAt: now }).success).toBe(true);
  });

  it("blocks automatic publication below the quality threshold", () => {
    const gate = { id: ids.contentId, organizationId: ids.organizationId, contentId: ids.contentId,
      name: "fact_check", status: "passed", score: 95, rationale: "Claims checked", checkedAt: now, checkedBy: "fact-checker", metadata: {} };
    expect(qualityGateSchema.safeParse(gate).success).toBe(true);
    expect(editorialQualityDecisionSchema.safeParse({ organizationId: ids.organizationId, contentId: ids.contentId,
      decision: "publish", score: 89, gateIds: [ids.contentId], decidedAt: now }).success).toBe(false);
  });
});

