import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAffectLedger } from "@/lib/psycheos/affect-ledger-pg";

const exec = promisify(execFile);
const container = `wave16-affect-pg-${process.pid}`;
const orgA = "org-a";
const orgB = "org-b";

function quote(value: unknown): string { return "'" + String(value).replace(/'/g, "''") + "'"; }
async function psql(sql: string, user = "postgres"): Promise<string> {
  const { stdout } = await exec("docker", ["exec", container, "psql", "-U", user, "-d", "test", "-At", "-F", "	", "-v", "ON_ERROR_STOP=1", "-c", sql]);
  return stdout.trim();
}
function pool(organizationId: string) {
  return {
    connect: async () => {
      const client = {
        query: async <T = unknown>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> => {
          if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") { await psql(text); return { rows: [] }; }
          if (text.startsWith("SELECT set_config")) { await psql("select set_config('app.organization_id'," + quote(organizationId) + ",true)", "app_user"); return { rows: [] }; }
          if (text.startsWith("INSERT INTO psyche_affect_events")) {
            const sql = "INSERT INTO psyche_affect_events (organization_id,agent_id,session_id,event_id,at_ms,pleasure,arousal,dominance) VALUES (" +
              [organizationId, values[1], values[2], values[3], values[4], values[5], values[6], values[7]].map(quote).join(",") +
              ") ON CONFLICT (organization_id,agent_id,session_id,event_id) DO NOTHING RETURNING organization_id,agent_id,session_id,event_id,at_ms,pleasure,arousal,dominance;";
            return { rows: parseRows(await psql("DO $$ BEGIN PERFORM set_config('app.organization_id'," + quote(organizationId) + ",true); END $$;" + sql, "app_user")) as T[] };
          }
          if (text.startsWith("SELECT organization_id, agent_id")) {
            const sql = "SELECT organization_id,agent_id,session_id,event_id,at_ms,pleasure,arousal,dominance FROM psyche_affect_events WHERE organization_id=" + quote(values[0]) + " AND agent_id=" + quote(values[1]) + " AND session_id=" + quote(values[2]) + " ORDER BY at_ms,event_id;";
            return { rows: parseRows(await psql("DO $$ BEGIN PERFORM set_config('app.organization_id'," + quote(organizationId) + ",true); END $$;" + sql, "app_user")) as T[] };
          }
          if (text.startsWith("SELECT organization_id")) {
            const sql = "SELECT organization_id,agent_id,session_id,event_id,at_ms,pleasure,arousal,dominance FROM psyche_affect_events WHERE organization_id=" + quote(values[0]) + " AND agent_id=" + quote(values[1]) + " AND session_id=" + quote(values[2]) + " AND event_id=" + quote(values[3]) + ";";
            return { rows: parseRows(await psql("DO $$ BEGIN PERFORM set_config('app.organization_id'," + quote(organizationId) + ",true); END $$;" + sql, "app_user")) as T[] };
          }
          throw new Error("unhandled query: " + text);
        },
        release: () => undefined,
      };
      return client;
    },
  };
}
function parseRows(output: string): Array<Record<string, unknown>> {
  return output ? output.split("\n").filter(Boolean).map((line) => {
    const [organization_id, agent_id, session_id, event_id, at_ms, pleasure, arousal, dominance] = line.split("\t");
    return { organization_id, agent_id, session_id, event_id, at_ms, pleasure: Number(pleasure), arousal: Number(arousal), dominance: Number(dominance) };
  }) : [];
}

describe("Wave 16 affect ledger with real PostgreSQL and RLS", () => {
  beforeAll(async () => {
    await exec("docker", ["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=test", "-e", "POSTGRES_DB=test", "postgres:16"]);
    for (let i = 0; i < 60; i += 1) {
      try { await exec("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", "test"]); await psql("select 1"); break; } catch { if (i === 59) throw new Error("postgres did not become ready"); await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    await psql("create role app_user login; create table public.psyche_affect_events (organization_id text not null, agent_id text not null, session_id text not null, event_id text not null, at_ms bigint not null check (at_ms >= 0), pleasure double precision not null check (pleasure between -1 and 1), arousal double precision not null check (arousal between -1 and 1), dominance double precision not null check (dominance between -1 and 1), created_at timestamptz not null default now(), primary key (organization_id,agent_id,session_id,event_id)); alter table public.psyche_affect_events enable row level security; alter table public.psyche_affect_events force row level security; create policy psyche_affect_tenant on public.psyche_affect_events for all to app_user using (organization_id=current_setting('app.organization_id', true)) with check (organization_id=current_setting('app.organization_id', true)); create function psyche_affect_append_only() returns trigger language plpgsql as $$ begin raise exception 'append-only affect ledger: UPDATE/DELETE denied'; end; $$; create trigger psyche_affect_append_only before update or delete on public.psyche_affect_events for each row execute function psyche_affect_append_only(); grant usage on schema public to app_user; grant select,insert,update,delete on public.psyche_affect_events to app_user;");
  }, 120_000);
  afterAll(async () => { await exec("docker", ["rm", "-f", container]).catch(() => undefined); });

  it("proves restart persistence, idempotency, append-only and tenant isolation", async () => {
    const first = new PostgresAffectLedger(pool(orgA) as never, orgA);
    const event = { organizationId: orgA, agentId: "agent", sessionId: "session", eventId: "event-1", atMs: 1000, pleasure: 0.7, arousal: -0.2, dominance: 0.4 };
    const [one, two] = await Promise.all([first.append(event), new PostgresAffectLedger(pool(orgA) as never, orgA).append(event)]);
    expect(one).toEqual(two);
    const restarted = new PostgresAffectLedger(pool(orgA) as never, orgA);
    expect(await restarted.read("agent", "session")).toHaveLength(1);
    expect(await new PostgresAffectLedger(pool(orgB) as never, orgB).read("agent", "session")).toHaveLength(0);
    await expect(psql("update psyche_affect_events set pleasure=0 where event_id='event-1'", "app_user")).rejects.toThrow(/append-only|permission/i);
  }, 120_000);
});
