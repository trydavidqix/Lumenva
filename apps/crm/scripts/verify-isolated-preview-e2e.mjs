#!/usr/bin/env node
// REAL read-only Auth and CRM schema proof, before any fixture writes.
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
const e = process.env;
const ref = e.E2E_PREVIEW_REF;
const production = e.E2E_PRODUCTION_REF;
if (e.E2E_TARGET_KIND !== "isolated-preview" || e.E2E_TARGET_ACK !== "isolated-empty-preview-only" ||
    !ref || !production || ref === production ||
    new URL(e.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname !== ref + ".supabase.co") {
  throw new Error("BLOCKED: not a dedicated isolated preview.");
}
const client = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await client.auth.admin.listUsers({ perPage: 1 });
if (error) throw new Error("BLOCKED: preview Auth admin credentials failed: " + error.message);
const pool = new pg.Pool({ connectionString: e.SUPABASE_DB_URL, max: 1, connectionTimeoutMillis: 10000 });
try {
  const db = await pool.query("select current_database() db, to_regclass('public.organizations') org, to_regclass('public.user_organizations') members, to_regclass('public.identity_user_mappings') identities, to_regclass('public.ai_agents') agents");
  const one = db.rows[0];
  if (!one.org || !one.members || !one.identities || !one.agents) throw new Error("preview CRM schema missing expected baseline tables.");
} finally { await pool.end(); }
console.log("PASS: real isolated Supabase preview Auth and CRM schema reached (read-only).");
