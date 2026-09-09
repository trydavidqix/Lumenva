import type {
  CustomerMemoryAuthority,
  CustomerMemoryFact,
  CustomerMemoryField,
  CustomerMemorySource,
} from "./types";

const AUTHORITATIVE_FIELDS = new Set<CustomerMemoryField>([
  "recent_order_ref",
  "payment_state",
  "consent_state",
]);

const MUTABLE_FIELDS = new Set<CustomerMemoryField>(["address", "phone"]);

const SOURCE_RANK: Record<CustomerMemorySource, number> = {
  conversation_derived: 1,
  customer_confirmed: 3,
  order: 4,
  system: 4,
  crm: 5,
};

export function authorityForField(field: CustomerMemoryField): CustomerMemoryAuthority {
  if (AUTHORITATIVE_FIELDS.has(field)) return "authoritative";
  if (MUTABLE_FIELDS.has(field)) return "mutable";
  return "derived";
}

function isExpired(fact: CustomerMemoryFact, now = Date.now()): boolean {
  return fact.validUntil !== null && Date.parse(fact.validUntil) <= now;
}

export function canUseMemoryFactOperationally(
  field: CustomerMemoryField,
  fact: CustomerMemoryFact,
): boolean {
  if (fact.conflicted || isExpired(fact)) return false;

  const authority = authorityForField(field);
  if (authority === "authoritative") {
    return (
      (fact.source === "crm" || fact.source === "order" || fact.source === "system") &&
      fact.confirmed &&
      fact.actionable
    );
  }

  if (authority === "mutable") {
    if (fact.source === "crm" || fact.source === "system") return true;
    if (fact.source === "customer_confirmed") return fact.confirmed;
    return fact.confirmed && fact.confidence >= 0.85;
  }

  if (fact.source === "crm" || fact.source === "order" || fact.source === "system") return true;
  if (fact.source === "customer_confirmed") return fact.confirmed;
  return fact.confidence >= 0.85;
}

export function chooseMemoryFact(
  field: CustomerMemoryField,
  facts: readonly CustomerMemoryFact[],
): CustomerMemoryFact | null {
  const usable = facts.filter((item) => !item.conflicted && !isExpired(item));
  if (usable.length === 0) return null;

  return [...usable].sort((a, b) => {
    const rank = SOURCE_RANK[b.source] - SOURCE_RANK[a.source];
    if (rank !== 0) return rank;
    if (a.confirmed !== b.confirmed) return Number(b.confirmed) - Number(a.confirmed);
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return Date.parse(b.validFrom) - Date.parse(a.validFrom);
  })[0] ?? null;
}
