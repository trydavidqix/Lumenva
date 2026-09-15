import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "../apps/crm/node_modules/pg";
import { PostgresConsentRegistry } from "./consent-registry";

let container = "";
let admin: Pool;
let adminUrl = "";

async function waitForPostgres(url: string): Promise<void> { for (let i = 0; i < 40; i += 1) { try { const p = new Pool({ connectionString: url }); await p.query("select 1"); await p.end(); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); } } throw new Error("postgres_query_not_ready"); }

describe("Postgres Consent Registry (real RLS)", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_not_found");
    adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    await waitForPostgres(adminUrl);
    admin = new Pool({ connectionString: adminUrl });
    await admin.query("CREATE ROLE authenticated NOLOGIN");
    await admin.query("CREATE ROLE consent_test LOGIN PASSWORD 'consent-test' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated");
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE SQL STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query(readFileSync("supabase/migrations/20260913110000_contact_consents.sql", "utf8"));
  });

  afterAll(async () => { await admin?.end(); if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" }); });

  it("persiste consentimento, reconstrói após nova pool, revoga e impede cross-tenant", async () => {
    const url = adminUrl.replace("postgres:test@", "consent_test:consent-test@");
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      await client.query("SET app.org_ids = 'org-a'");
      const registry = new PostgresConsentRegistry(client);
      const input = { consent_id: "consent-1", organization_id: "org-a", subject_ref: "contact-1", purpose: "support", channel: "email" as const, source_refs: ["form-1"], evidence_refs: ["event-1"], granted_at: new Date(Date.now() - 1_000).toISOString(), retention_until: new Date(Date.now() + 86_400_000).toISOString() };
      await expect(registry.register(input)).resolves.toMatchObject({ status: "GRANTED", organization_id: "org-a" });
      expect(await registry.canContact("org-a", "contact-1", "email", "support")).toBe(true);
      expect(await registry.canContact("org-a", "contact-1", "voice", "support")).toBe(false);
    } finally { client.release(); await pool.end(); }

    const restarted = new Pool({ connectionString: url });
    const restartedClient = await restarted.connect();
    try {
      await restartedClient.query("SET app.org_ids = 'org-a'");
      const registry = new PostgresConsentRegistry(restartedClient);
      await expect(registry.get("org-a", "consent-1")).resolves.toMatchObject({ status: "GRANTED" });
      await registry.revoke("org-a", "consent-1", "2026-09-13T11:00:00.000Z");
      expect(await registry.canContact("org-a", "contact-1", "email", "support")).toBe(false);
    } finally { restartedClient.release(); await restarted.end(); }

    const cross = new Pool({ connectionString: url });
    const crossClient = await cross.connect();
    try {
      await crossClient.query("SET app.org_ids = 'org-b'");
      const registry = new PostgresConsentRegistry(crossClient);
      await expect(registry.get("org-b", "consent-1")).resolves.toBeUndefined();
      expect(await registry.canContact("org-b", "contact-1", "email", "support")).toBe(false);
      const crossUpdate = await crossClient.query("UPDATE public.contact_consents SET status='GRANTED' WHERE organization_id='org-a' AND consent_id='consent-1'");
      expect(crossUpdate.rowCount).toBe(0);
    } finally { crossClient.release(); await cross.end(); }
  });
});
