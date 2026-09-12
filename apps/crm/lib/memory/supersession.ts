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

export type SupersessionCommit = (result: SupersessionResult) => void | Promise<void>;

/**
 * Coordena commits por par de registos. O lock permanece até o callback terminar;
 * retries do mesmo par reutilizam o resultado já committed e não escrevem novamente.
 */
export function createSupersessionCoordinator() {
  const committed = new Map<string, SupersessionResult>();
  const locks = new Map<string, Promise<void>>();

  return {
    async resolve(
      r1: MemoryEvent,
      r2: MemoryEvent,
      commit: SupersessionCommit,
    ): Promise<SupersessionResult> {
      const key = [r1.recordId, r2.recordId].sort().join("::");
      const previous = locks.get(key) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      const tail = previous.then(() => current);
      locks.set(key, tail);

      await previous;
      try {
        const existing = committed.get(key);
        if (existing) return existing;

        const result = resolveSupersession(r1, r2);
        await commit(result);
        committed.set(key, result);
        return result;
      } finally {
        release();
        if (locks.get(key) === tail) locks.delete(key);
      }
    },
  };
}
