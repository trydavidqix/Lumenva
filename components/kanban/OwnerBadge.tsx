import { Badge } from "@/components/ui/badge";

/** Iniciais a partir do nome (primeira + última palavra). */
export function ownerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Exibe o responsável (owner) de um lead. Presentacional e sem dnd — testável
 * em isolamento. Badge distinta (borda tracejada, tokens do design system) para
 * o caso `owner == null`.
 */
export function OwnerBadge({
  ownerUserId,
  ownerName,
}: {
  ownerUserId: string | null;
  ownerName: string | null;
}) {
  if (!ownerUserId) {
    return (
      <Badge
        variant="outline"
        className="border-dashed px-2 text-text-muted"
        aria-label="Sem responsável"
      >
        Sem responsável
      </Badge>
    );
  }

  const label = ownerName ?? "Responsável";
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`Responsável: ${label}`}
    >
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent"
        aria-hidden
      >
        {ownerName ? ownerInitials(ownerName) : "?"}
      </span>
      <span className="max-w-[9rem] truncate text-xs text-text-muted">
        {label}
      </span>
    </div>
  );
}
