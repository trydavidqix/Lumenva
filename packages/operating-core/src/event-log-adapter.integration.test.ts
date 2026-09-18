import { describe, expect, it } from "vitest";
import pg from "../../../apps/crm/node_modules/pg";
import { createPostgresJobEventLogAdapter } from "./event-log-adapter";
const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)("event_log adapter PostgreSQL real", () => {
  it("appends idempotently and replays only the tenant stream", async () => {
    const url=databaseUrl!;
    const pool=new pg.Pool({connectionString:url}); await pool.query("create table if not exists event_log (id text primary key, organization_id text not null, event_type text not null, entity_kind text not null, entity_id text not null, payload jsonb not null, metadata jsonb, created_at timestamptz default now())"); await pool.query("truncate event_log");
    const adapter=createPostgresJobEventLogAdapter(pool); const event={id:"evt-real",organizationId:"org-a",jobId:"job-a",type:"job.queued" as const,occurredAt:"2026-09-13T00:00:00Z",payload:{kind:"sync"},metadata:{attempts:0}};
    expect((await adapter.append(event)).deduped).toBe(false); expect((await adapter.append(event)).deduped).toBe(true); expect(await adapter.replay({organizationId:"org-a"})).toHaveLength(1); expect(await adapter.replay({organizationId:"org-b"})).toHaveLength(0); await pool.end();
  });
});
