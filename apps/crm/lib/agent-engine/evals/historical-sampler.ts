export interface HistoricalReplayCandidate {
  id: string;
  organizationId: string;
  bucket: string;
  input: Readonly<Record<string, unknown>>;
  humanReference?: Readonly<Record<string, unknown>>;
}

export interface HistoricalReplayReadPort {
  listCandidates(input: {
    organizationId: string;
    limit: number;
  }): Promise<readonly HistoricalReplayCandidate[]>;
}

const SENSITIVE_KEYS = new Set(['email', 'phone', 'phone_number', 'mobile', 'whatsapp', 'whatsapp_number']);

function sanitizeRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return [key, sanitizeRecord(item as Readonly<Record<string, unknown>>)] as const;
        }
        return [key, item] as const;
      }),
  );
}

function sanitizeCandidate(candidate: HistoricalReplayCandidate): HistoricalReplayCandidate {
  return {
    ...candidate,
    input: sanitizeRecord(candidate.input),
    humanReference: candidate.humanReference ? sanitizeRecord(candidate.humanReference) : undefined,
  };
}

export function createHistoricalReplaySampler(readPort: HistoricalReplayReadPort) {
  return {
    async sample(input: { organizationId: string; perBucket: number }): Promise<readonly HistoricalReplayCandidate[]> {
      const perBucket = Math.max(0, Math.floor(input.perBucket));
      if (!input.organizationId.trim() || perBucket === 0) return [];

      const candidates = await readPort.listCandidates({
        organizationId: input.organizationId,
        limit: Math.max(perBucket * 20, perBucket),
      });

      const scoped = candidates
        .filter((candidate) => candidate.organizationId === input.organizationId)
        .filter((candidate) => candidate.id.trim() && candidate.bucket.trim())
        .map(sanitizeCandidate)
        .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.id.localeCompare(b.id));

      const counts = new Map<string, number>();
      return scoped.filter((candidate) => {
        const count = counts.get(candidate.bucket) ?? 0;
        if (count >= perBucket) return false;
        counts.set(candidate.bucket, count + 1);
        return true;
      });
    },
  };
}
