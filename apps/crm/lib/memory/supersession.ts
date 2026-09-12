import type { MemoryEvent } from "./context-compiler";

export interface SupersessionResult {
  current: MemoryEvent;
  superseded: MemoryEvent;
}

/**
 * Resolve dois registos do mesmo subject: observação mais recente vence;
 * confidence desempata. Retorna clones para manter o ledger de entrada intacto.
 */
export function resolveSupersession(r1: MemoryEvent, r2: MemoryEvent): SupersessionResult {
  if (
    r1.organizationId !== r2.organizationId ||
    r1.subject !== r2.subject ||
    r1.scope !== r2.scope
  ) {
    throw new Error("supersession_namespace_mismatch");
  }

  const r2Wins =
    r2.observedAt > r1.observedAt ||
    (r2.observedAt === r1.observedAt && r2.confidence > r1.confidence);
  const winner = r2Wins ? r2 : r1;
  const loser = r2Wins ? r1 : r2;

  return {
    current: { ...winner, lifecycle: "active", supersedes: loser.recordId },
    superseded: { ...loser, lifecycle: "superseded" },
  };
}
