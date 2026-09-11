import { describe, expect, it, vi } from "vitest";
import type { JobEvent } from "./contracts.js";
import { EVENT_LOG_SCHEMA_VERSION, createPostgresJobEventLogAdapter } from "./event-log-adapter.js";

const event: JobEvent = {
  id: "event-1",
  organizationId: "org-1",
  jobId: "job-1",
  type: "job.queued",
  occurredAt: "2026-09-11T00:00:00.000Z",
  payload: { kind: "sync" },
  metadata: { attempts: 0 },
};

describe("Job/Event event_log adapter", () => {
  it("serializes a versioned event and treats a conflict as idempotent replay", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: event.id }] })
      .mockResolvedValueOnce({ rows: [] });
    const adapter = createPostgresJobEventLogAdapter({ query });

    await expect(adapter.append(event)).resolves.toMatchObject({ deduped: false });
    await expect(adapter.append(event)).resolves.toMatchObject({ deduped: true });

    const [, values] = query.mock.calls[0] as [string, unknown[]];
    const envelope = JSON.parse(String(values[4])) as { schema_version: number; event: JobEvent };
    expect(envelope.schema_version).toBe(EVENT_LOG_SCHEMA_VERSION);
    expect(envelope.event).toEqual(event);
    expect(String(query.mock.calls[0]?.[0])).toContain("on conflict (id) do nothing");
  });

  it("replays only the tenant/job event stream and verifies identity", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: event.id,
          organization_id: event.organizationId,
          event_type: "operating_core.job.queued",
          entity_id: event.jobId,
          payload: JSON.stringify({ schema_version: 1, event }),
          metadata: { schema_version: 1 },
          created_at: event.occurredAt,
        },
      ],
    });
    const adapter = createPostgresJobEventLogAdapter({ query });

    await expect(
      adapter.replay({ organizationId: event.organizationId, jobId: event.jobId }),
    ).resolves.toEqual([event]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("entity_kind = 'operating_core_job'"),
      [event.organizationId, expect.any(Array), 100, event.jobId],
    );
  });

  it("fails closed on an unsupported serialized version", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: event.id,
          organization_id: event.organizationId,
          event_type: "operating_core.job.queued",
          entity_id: event.jobId,
          payload: { schema_version: 99, event },
          metadata: null,
          created_at: event.occurredAt,
        },
      ],
    });
    const adapter = createPostgresJobEventLogAdapter({ query });
    await expect(adapter.replay({ organizationId: event.organizationId })).rejects.toThrow(
      "operating_core_event_schema_version_unsupported",
    );
  });
});
