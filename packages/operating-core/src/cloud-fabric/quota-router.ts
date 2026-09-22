import type { ExecutionPort, QuotaSnapshot } from './execution-port';

export type QuotaState = 'GREEN' | 'YELLOW' | 'RED' | 'RESERVE' | 'UNKNOWN';

export interface ProviderQuota {
  port: ExecutionPort;
  snapshot: QuotaSnapshot;
  state: QuotaState;
}

export function quotaState(snapshot: QuotaSnapshot): QuotaState {
  if (typeof snapshot.remaining_percent !== 'number') {
    if (snapshot.remaining_budget === undefined) return 'UNKNOWN';
    return snapshot.remaining_budget > 0 ? 'GREEN' : 'RESERVE';
  }
  if (snapshot.remaining_percent > 50) return 'GREEN';
  if (snapshot.remaining_percent > 20) return 'YELLOW';
  if (snapshot.remaining_percent >= 10) return 'RED';
  return 'RESERVE';
}

export class QuotaRouter {
  async inspect(providers: ExecutionPort[]): Promise<ProviderQuota[]> {
    const results: ProviderQuota[] = [];
    for (const port of providers) {
      try {
        const snapshot = await port.checkQuota();
        results.push({ port, snapshot, state: quotaState(snapshot) });
      } catch {
        results.push({
          port,
          snapshot: {
            provider: port.name,
            tokens_used: 0,
            cost_usd: 0,
            health: 'unavailable',
            measurement_type: 'unavailable',
          },
          state: 'UNKNOWN',
        });
      }
    }
    return results;
  }

  async selectProviderBasedOnQuota(
    providers: ExecutionPort[],
    options: { allowReserve?: boolean; prefer?: string[] } = {},
  ): Promise<ExecutionPort> {
    const inspected = await this.inspect(providers);
    const rank: Record<QuotaState, number> = {
      GREEN: 4,
      YELLOW: 3,
      RED: 2,
      UNKNOWN: 1,
      RESERVE: options.allowReserve ? 1 : 0,
    };
    const preferred = new Map((options.prefer ?? []).map((name, index) => [name, index]));
    const eligible = inspected
      .filter(({ snapshot, state }) => snapshot.health !== 'unavailable' && rank[state] > 0)
      .sort((a, b) => {
        const stateDelta = rank[b.state] - rank[a.state];
        if (stateDelta !== 0) return stateDelta;
        const aPref = preferred.get(a.port.name) ?? Number.MAX_SAFE_INTEGER;
        const bPref = preferred.get(b.port.name) ?? Number.MAX_SAFE_INTEGER;
        return aPref - bPref;
      });

    const selected = eligible[0]?.port;
    if (!selected) throw new Error('No providers with available quota.');
    return selected;
  }
}
