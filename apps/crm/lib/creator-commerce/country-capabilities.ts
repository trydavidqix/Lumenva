export const capabilityStatuses = ["ALLOW", "REVIEW_REQUIRED", "DENY", "UNKNOWN"] as const;
export type CapabilityStatus = (typeof capabilityStatuses)[number];

export type ProviderCountryCapabilityEvidence = Readonly<{
  provider: string;
  country: string;
  capability: string;
  status: CapabilityStatus;
  requirements: readonly string[];
  termsVersion: string | null;
  lastVerifiedAt: string | null;
  source: string;
  evidenceRefs: readonly string[];
}>;

export type CapabilityDecision = Readonly<{
  status: CapabilityStatus;
  provider: string | null;
  country: string | null;
  capability: string | null;
  requirements: readonly string[];
  evidenceRefs: readonly string[];
  ruleIds: readonly string[];
  newestVerifiedAt: string | null;
}>;

export type EvaluateCountryCapabilityInput = {
  records: readonly ProviderCountryCapabilityEvidence[];
  now?: Date;
  maxAgeMs?: number;
  staleDecision?: "UNKNOWN" | "REVIEW_REQUIRED";
};

const PRIORITY: Readonly<Record<CapabilityStatus, number>> = {
  DENY: 4,
  REVIEW_REQUIRED: 3,
  ALLOW: 2,
  UNKNOWN: 1,
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function isFresh(record: ProviderCountryCapabilityEvidence, now: Date, maxAgeMs: number): boolean {
  if (!record.lastVerifiedAt) return false;
  const verifiedAt = Date.parse(record.lastVerifiedAt);
  if (!Number.isFinite(verifiedAt)) return false;
  const age = now.getTime() - verifiedAt;
  return age >= 0 && age <= maxAgeMs;
}

function assertSameCapability(records: readonly ProviderCountryCapabilityEvidence[]): void {
  if (records.length < 2) return;
  const first = records[0];
  const key = `${first.provider}\u0000${first.country.toUpperCase()}\u0000${first.capability}`;
  for (const record of records.slice(1)) {
    const candidate = `${record.provider}\u0000${record.country.toUpperCase()}\u0000${record.capability}`;
    if (candidate !== key) {
      throw new Error("country capability evidence must refer to one provider/country/capability tuple");
    }
  }
}

/**
 * Deterministic country/provider capability gate.
 *
 * Safety invariants:
 * - UNKNOWN is never promoted to ALLOW.
 * - an explicit DENY is fail-closed even if the evidence later becomes stale;
 *   stale denial can be reviewed and refreshed, but cannot silently become executable.
 * - stale positive/review evidence degrades according to the configured fail-closed policy.
 */
export function evaluateCountryCapability(input: EvaluateCountryCapabilityInput): CapabilityDecision {
  const now = input.now ?? new Date();
  const maxAgeMs = Math.max(0, input.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000);
  const staleDecision = input.staleDecision ?? "UNKNOWN";
  const records = input.records;

  if (records.length === 0) {
    return Object.freeze({
      status: "UNKNOWN",
      provider: null,
      country: null,
      capability: null,
      requirements: [],
      evidenceRefs: [],
      ruleIds: ["country_capability.no_evidence"],
      newestVerifiedAt: null,
    });
  }

  assertSameCapability(records);
  const explicitDeny = records.find((record) => record.status === "DENY");
  const fresh = records.filter((record) => isFresh(record, now, maxAgeMs));
  const considered = explicitDeny ? records : fresh;
  const first = records[0];

  let status: CapabilityStatus;
  let ruleIds: string[];
  if (explicitDeny) {
    status = "DENY";
    ruleIds = ["country_capability.explicit_deny"];
  } else if (considered.length === 0) {
    status = staleDecision;
    ruleIds = ["country_capability.stale_evidence"];
  } else {
    status = considered.reduce<CapabilityStatus>(
      (current, record) => (PRIORITY[record.status] > PRIORITY[current] ? record.status : current),
      "UNKNOWN",
    );
    ruleIds = [
      status === "ALLOW"
        ? "country_capability.explicit_allow"
        : status === "REVIEW_REQUIRED"
          ? "country_capability.review_required"
          : "country_capability.unknown",
    ];
  }

  const newestVerifiedAt = records
    .map((record) => record.lastVerifiedAt)
    .filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

  return Object.freeze({
    status,
    provider: first.provider,
    country: first.country.toUpperCase(),
    capability: first.capability,
    requirements: unique(records.flatMap((record) => [...record.requirements])),
    evidenceRefs: unique(records.flatMap((record) => [...record.evidenceRefs])),
    ruleIds,
    newestVerifiedAt,
  });
}
