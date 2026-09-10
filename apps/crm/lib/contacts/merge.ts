export interface MergeCandidate {
  id: string;
  completeness: number;
  created_at: string;
  last_activity_at: string | null;
}

export function pickPrimary(candidates: readonly MergeCandidate[]): MergeCandidate | null {
  return [...candidates].sort((a, b) =>
    b.completeness - a.completeness ||
    a.created_at.localeCompare(b.created_at) ||
    (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? "") ||
    a.id.localeCompare(b.id),
  )[0] ?? null;
}

export type MergeAction =
  | { action: "merge"; primary_id: string; loser_ids: string[] }
  | { action: "discard" };

export type MergeValidation =
  | { ok: true; value: MergeAction }
  | { ok: false; reason: "invalid_action" | "primary_in_losers" | "empty_losers" };

export function validateMergeAction(input: unknown): MergeValidation {
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid_action" };
  const value = input as Record<string, unknown>;
  if (value.action === "discard") return { ok: true, value: { action: "discard" } };
  if (value.action !== "merge" || typeof value.primary_id !== "string" || !Array.isArray(value.loser_ids)) {
    return { ok: false, reason: "invalid_action" };
  }
  const losers = value.loser_ids.filter((id): id is string => typeof id === "string");
  if (losers.length === 0) return { ok: false, reason: "empty_losers" };
  if (losers.includes(value.primary_id)) return { ok: false, reason: "primary_in_losers" };
  return { ok: true, value: { action: "merge", primary_id: value.primary_id, loser_ids: [...new Set(losers)] } };
}

export interface MergeContactRecord {
  id: string;
  organization_id: string;
  is_anonymized: boolean;
}

export type MergePlanResult =
  | { ok: true; primary_id: string; loser_ids: string[] }
  | { ok: false; reason: "forbidden_role" | "tenant_mismatch" | "primary_anonymized" | "contacts_not_found" };

export function buildMergePlan(
  roleRank: number,
  organizationId: string,
  contacts: readonly MergeContactRecord[],
  action: Extract<MergeAction, { action: "merge" }>,
): MergePlanResult {
  if (roleRank < 3) return { ok: false, reason: "forbidden_role" };
  if (contacts.some((c) => c.organization_id !== organizationId)) return { ok: false, reason: "tenant_mismatch" };
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const primary = byId.get(action.primary_id);
  if (!primary || action.loser_ids.some((id) => !byId.has(id))) return { ok: false, reason: "contacts_not_found" };
  if (primary.is_anonymized) return { ok: false, reason: "primary_anonymized" };
  return { ok: true, primary_id: primary.id, loser_ids: [...new Set(action.loser_ids)] };
}
