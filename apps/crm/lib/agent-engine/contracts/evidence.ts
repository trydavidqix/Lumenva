import { createHash } from "node:crypto";

export type EvidenceOutcome = "observed" | "verified" | "rejected";

export interface EvidenceItem {
  id: string;
  organizationId: string;
  claim: string;
  source: string;
  outcome: EvidenceOutcome;
  artifact?: string;
  traceId?: string;
  createdAt: string;
  contentHash: string;
}

export interface CreateEvidenceInput {
  id: string;
  organizationId: string;
  claim: string;
  source: string;
  outcome?: EvidenceOutcome;
  artifact?: string;
  traceId?: string;
  createdAt: string;
}

export function createEvidenceItem(input: CreateEvidenceInput): EvidenceItem {
  if (!input.id || !input.organizationId || !input.claim || !input.source) {
    throw new Error("evidence_required_fields");
  }
  const canonical = JSON.stringify({
    id: input.id,
    organizationId: input.organizationId,
    claim: input.claim,
    source: input.source,
    outcome: input.outcome ?? "observed",
    artifact: input.artifact ?? null,
    traceId: input.traceId ?? null,
    createdAt: input.createdAt,
  });
  return {
    ...input,
    outcome: input.outcome ?? "observed",
    contentHash: createHash("sha256").update(canonical).digest("hex"),
  };
}

export function verifyEvidenceTenant(item: EvidenceItem, organizationId: string): boolean {
  return item.organizationId === organizationId;
}
