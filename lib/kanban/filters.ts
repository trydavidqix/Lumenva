import type { Lead } from "@/lib/types/leads";

export interface LeadFilters {
  ownerUserId?: string | "any" | "unassigned";
  status?: "all" | "open" | "won" | "lost";
  tag?: string;
  search?: string;
  valueCentsMin?: number | null;
  valueCentsMax?: number | null;
  overdueOnly?: boolean;
}

/**
 * Serializa/deserializa os filtros do board em query params (deep-linkável).
 * Só os controles expostos na FilterBar: owner, status, tag, busca, atrasados.
 */
export function filtersFromParams(
  sp: { get(key: string): string | null },
): LeadFilters {
  const owner = sp.get("owner");
  const status = sp.get("status");
  const tag = sp.get("tag");
  const search = sp.get("q");
  return {
    ownerUserId: owner ?? undefined,
    status:
      status === "open" || status === "won" || status === "lost" || status === "all"
        ? status
        : "all",
    tag: tag ?? undefined,
    search: search ?? undefined,
    overdueOnly: sp.get("overdue") === "1" || undefined,
  };
}

export function filtersToParams(f: LeadFilters): string {
  const p = new URLSearchParams();
  if (f.ownerUserId && f.ownerUserId !== "any") p.set("owner", f.ownerUserId);
  if (f.status && f.status !== "all") p.set("status", f.status);
  if (f.tag) p.set("tag", f.tag);
  if (f.search?.trim()) p.set("q", f.search.trim());
  if (f.overdueOnly) p.set("overdue", "1");
  return p.toString();
}

export function applyFilters(leads: Lead[], f: LeadFilters): Lead[] {
  const today = new Date().toISOString().slice(0, 10);
  const search = f.search?.trim().toLowerCase() ?? "";

  return leads.filter((l) => {
    if (f.ownerUserId === "unassigned" && l.owner_user_id !== null) return false;
    if (
      f.ownerUserId &&
      f.ownerUserId !== "any" &&
      f.ownerUserId !== "unassigned" &&
      l.owner_user_id !== f.ownerUserId
    )
      return false;
    if (f.status && f.status !== "all" && l.status !== f.status) return false;
    if (f.tag && !l.tags.includes(f.tag)) return false;
    if (
      search &&
      !`${l.title} ${l.description ?? ""}`.toLowerCase().includes(search)
    )
      return false;
    if (typeof f.valueCentsMin === "number" && (l.value_cents ?? 0) < f.valueCentsMin)
      return false;
    if (typeof f.valueCentsMax === "number" && (l.value_cents ?? 0) > f.valueCentsMax)
      return false;
    if (f.overdueOnly) {
      if (l.status !== "open") return false;
      if (!l.expected_close_date || l.expected_close_date >= today) return false;
    }
    return true;
  });
}
