import type { HistoricalReplayCandidate, HistoricalReplayReadPort } from './historical-sampler';

interface QueryResult<Row> {
  rows: readonly Row[];
  rowCount?: number | null;
}

export interface ReadOnlyQueryable {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

interface HistoricalReplayRow {
  id: string;
  organization_id: string;
  bucket: string;
  input: unknown;
  human_reference?: unknown;
}

const SENSITIVE_KEYS = new Set(['email', 'phone', 'phone_number', 'mobile', 'whatsapp', 'whatsapp_number']);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => {
        if (isRecord(item)) return [key, sanitizeRecord(item)] as const;
        return [key, item] as const;
      }),
  );
}

function mapRow(row: HistoricalReplayRow, organizationId: string): HistoricalReplayCandidate | null {
  if (row.organization_id !== organizationId) return null;
  if (!row.id?.trim() || !row.bucket?.trim() || !isRecord(row.input)) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    bucket: row.bucket,
    input: sanitizeRecord(row.input),
    humanReference: isRecord(row.human_reference) ? sanitizeRecord(row.human_reference) : undefined,
  };
}

export function createHistoricalReplayReadAdapter(db: ReadOnlyQueryable): HistoricalReplayReadPort {
  return {
    async listCandidates(input) {
      const organizationId = input.organizationId.trim();
      const limit = Math.floor(input.limit);
      if (!organizationId || !Number.isFinite(limit) || limit <= 0) return [];

      const { rows } = await db.query<HistoricalReplayRow>(
        `select
           id,
           organization_id,
           bucket,
           input,
           human_reference
         from agent_eval_historical_replay_candidates
         where organization_id = $1
         order by bucket asc, id asc
         limit $2`,
        [organizationId, limit],
      );

      return rows
        .map((row) => mapRow(row, organizationId))
        .filter((row): row is HistoricalReplayCandidate => row !== null);
    },
  };
}
