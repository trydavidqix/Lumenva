import type { MemoryEvent } from "./context-compiler";

export interface ProjectionQuery {
  organizationId: string;
  subject: string;
  scope: string;
}

function writeOrder(event: MemoryEvent): string {
  return event.createdAt ?? event.observedAt;
}

export function rebuildMemoryProjection(
  ledger: readonly MemoryEvent[],
  query: ProjectionQuery,
): MemoryEvent[] {
  const current = new Map<string, MemoryEvent>();
  const ordered = [...ledger]
    .filter((event) =>
      event.organizationId === query.organizationId &&
      event.subject === query.subject &&
      event.scope === query.scope,
    )
    .sort((a, b) =>
      writeOrder(a).localeCompare(writeOrder(b)) ||
      a.recordId.localeCompare(b.recordId),
    );

  for (const event of ordered) {
    if (event.lifecycle === "rejected" || event.lifecycle === "redacted" || event.lifecycle === "superseded") {
      continue;
    }
    if (event.supersedes) current.delete(event.supersedes);
    current.delete(event.recordId);
    current.set(event.recordId, { ...event });
  }

  return [...current.values()];
}
