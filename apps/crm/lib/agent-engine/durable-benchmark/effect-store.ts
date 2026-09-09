export interface BenchmarkEffectStore {
  commitOnce(input: {
    organizationId: string;
    idempotencyKey: string;
  }): Promise<{ committed: boolean; committedCount: number }>;
}

export function createInMemoryBenchmarkEffectStore(): BenchmarkEffectStore {
  const committed = new Set<string>();

  return {
    async commitOnce({ organizationId, idempotencyKey }) {
      if (!organizationId.startsWith('bench-org-')) {
        throw new Error('benchmark_effect_store_rejects_non_synthetic_organization');
      }
      if (!idempotencyKey.trim()) {
        throw new Error('benchmark_effect_store_requires_idempotency_key');
      }

      const key = `${organizationId}:${idempotencyKey}`;
      const alreadyCommitted = committed.has(key);
      if (!alreadyCommitted) committed.add(key);

      return {
        committed: !alreadyCommitted,
        committedCount: committed.has(key) ? 1 : 0,
      };
    },
  };
}
