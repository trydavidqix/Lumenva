import type { FinancialFact } from "./contracts";

export interface ReconciliationFinding {
  kind: "unknown_outcome" | "provider_correction" | "missing_internal";
  externalId: string;
  requiresReview: boolean;
  evidence: Record<string, unknown>;
}

export interface ReconciliationInput {
  organizationId: string;
  providerFacts: FinancialFact[];
  existingFacts: FinancialFact[];
  unknownOutcomes?: string[];
}

export interface ReconciliationResult {
  toInsert: FinancialFact[];
  findings: ReconciliationFinding[];
  nextCursor: string | null;
}

export function reconcileProviderFacts(input: ReconciliationInput): ReconciliationResult {
  const existing = new Map(
    input.existingFacts
      .filter((fact) => fact.organizationId === input.organizationId)
      .map((fact) => [`${fact.provider}:${fact.externalId}`, fact]),
  );
  const seen = new Set<string>();
  const toInsert: FinancialFact[] = [];
  const findings: ReconciliationFinding[] = [];

  for (const providerFact of input.providerFacts) {
    if (providerFact.organizationId !== input.organizationId) throw new Error("reconciliation_tenant_mismatch");
    const key = `${providerFact.provider}:${providerFact.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const current = existing.get(key);
    if (!current) {
      toInsert.push(providerFact);
      findings.push({ kind: "missing_internal", externalId: providerFact.externalId, requiresReview: false, evidence: { provider: providerFact.provider } });
      continue;
    }
    if (current.amountMinor !== providerFact.amountMinor || current.currency !== providerFact.currency || current.kind !== providerFact.kind) {
      findings.push({
        kind: "provider_correction",
        externalId: providerFact.externalId,
        requiresReview: true,
        evidence: { previousAmountMinor: current.amountMinor, providerAmountMinor: providerFact.amountMinor },
      });
      toInsert.push({
        ...providerFact,
        id: `${providerFact.id}:correction`,
        externalId: `${providerFact.externalId}:correction:${providerFact.occurredAt}`,
        evidence: { ...providerFact.evidence, correctsExternalId: providerFact.externalId },
      });
    }
  }

  for (const externalId of input.unknownOutcomes ?? []) {
    findings.push({ kind: "unknown_outcome", externalId, requiresReview: true, evidence: { reason: "side_effect_outcome_unconfirmed" } });
  }

  return { toInsert, findings, nextCursor: input.providerFacts.at(-1)?.occurredAt ?? null };
}
