import type { JobEvent, JobEventType } from "./contracts.js";

export const EVENT_LOG_SCHEMA_VERSION = 1 as const;
const EVENT_LOG_PREFIX = "operating_core.";

export interface EventLogQueryable {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface EventLogRow {
  id: string;
  organization_id: string;
  event_type: string;
  entity_id: string;
  payload: unknown;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface EventLogEnvelope {
  schema_version: typeof EVENT_LOG_SCHEMA_VERSION;
  event: JobEvent;
}

export interface AppendEventResult {
  event: JobEvent;
  deduped: boolean;
}

export interface JobEventLogAdapter {
  append(event: JobEvent): Promise<AppendEventResult>;
  replay(input: {
    organizationId: string;
    jobId?: string;
    limit?: number;
  }): Promise<readonly JobEvent[]>;
}

const EVENT_TYPES = new Set<JobEventType>([
  "job.queued",
  "job.claimed",
  "job.running",
  "job.completed",
  "job.evidence",
]);

function eventType(type: JobEventType): string {
  return EVENT_LOG_PREFIX + type;
}

function envelope(event: JobEvent): EventLogEnvelope {
  if (!EVENT_TYPES.has(event.type)) {
    throw new Error("operating_core_unknown_event_type");
  }
  return { schema_version: EVENT_LOG_SCHEMA_VERSION, event };
}

function parseEnvelope(row: EventLogRow): JobEvent {
  if (row.event_type.startsWith(EVENT_LOG_PREFIX) === false) {
    throw new Error("operating_core_event_type_mismatch");
  }
  const value =
    typeof row.payload === "string" ? (JSON.parse(row.payload) as unknown) : row.payload;
  if (!value || typeof value !== "object") {
    throw new Error("operating_core_event_payload_invalid");
  }
  const candidate = value as Partial<EventLogEnvelope>;
  if (candidate.schema_version !== EVENT_LOG_SCHEMA_VERSION || !candidate.event) {
    throw new Error("operating_core_event_schema_version_unsupported");
  }
  const event = candidate.event;
  if (
    event.id !== row.id ||
    event.organizationId !== row.organization_id ||
    event.jobId !== row.entity_id ||
    eventType(event.type) !== row.event_type
  ) {
    throw new Error("operating_core_event_identity_mismatch");
  }
  return event;
}

export function createPostgresJobEventLogAdapter(
  db: EventLogQueryable,
): JobEventLogAdapter {
  return {
    async append(event) {
      const serialized = envelope(event);
      const result = await db.query<{ id: string }>(
        `insert into event_log
           (id, organization_id, event_type, entity_kind, entity_id, payload, metadata)
         values ($1, $2, $3, 'operating_core_job', $4, $5::jsonb, $6::jsonb)
         on conflict (id) do nothing
         returning id`,
        [
          event.id,
          event.organizationId,
          eventType(event.type),
          event.jobId,
          JSON.stringify(serialized),
          JSON.stringify({
            schema_version: EVENT_LOG_SCHEMA_VERSION,
            source: "operating_core",
            job_id: event.jobId,
          }),
        ],
      );
      return { event, deduped: result.rows.length === 0 };
    },

    async replay(input) {
      const limit = Math.max(1, Math.min(input.limit ?? 100, 1000));
      const types = [...EVENT_TYPES].map(eventType);
      const values: readonly unknown[] = [input.organizationId, types, limit];
      let sql = `select id, organization_id, event_type, entity_id, payload, metadata, created_at
           from event_log
          where organization_id = $1
            and entity_kind = 'operating_core_job'
            and event_type = any($2::text[])`;
      if (input.jobId) {
        sql += " and entity_id = $4";
      }
      sql += " order by created_at asc, id asc limit $3";
      const queryValues = input.jobId ? [...values, input.jobId] : values;
      const result = await db.query<EventLogRow>(sql, queryValues);
      return result.rows.map(parseEnvelope);
    },
  };
}
