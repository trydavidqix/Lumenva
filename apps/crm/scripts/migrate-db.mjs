import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { isBaselineCovered, isSupabaseManagedUrl } from "./migration-policy.mjs";

const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
if (!url) throw new Error("DATABASE_URL ou SUPABASE_DB_URL é obrigatório");
const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "supabase", "migrations");
const baseline = join(root, "supabase", "baseline.sql");
const pool = new pg.Pool({ connectionString: url });
try {
  // Supabase-compatible prelude for self-host PostgreSQL; baseline is canonical schema.
  if (!isSupabaseManagedUrl(url)) await pool.query(await readFile(join(root, "scripts", "selfhost-prelude.sql"), "utf8"));
  await pool.query("create schema if not exists extensions");
  await pool.query("create extension if not exists \"uuid-ossp\" with schema extensions");
  await pool.query("create extension if not exists \"pgcrypto\" with schema extensions");
  await pool.query("create extension if not exists \"citext\"");
  await pool.query("create extension if not exists \"pg_trgm\"");
  await pool.query("create extension if not exists \"vector\"");
  await pool.query("create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())");
  const baselineVersion = "00000_baseline";
  const { rowCount: baselineApplied } = await pool.query("select 1 from public.schema_migrations where version = $1", [baselineVersion]);
  if (!baselineApplied) {
    const sql = await readFile(baseline, "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public.schema_migrations(version) values ($1)", [baselineVersion]);
      await client.query("commit");
      console.log(`applied ${baselineVersion}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally { client.release(); }
  }
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const { rowCount } = await pool.query("select 1 from public.schema_migrations where version = $1", [version]);
    if (rowCount) continue;
    const baselineCoversMigration = isBaselineCovered(file);
    if (baselineCoversMigration) {
      await pool.query("insert into public.schema_migrations(version) values ($1) on conflict (version) do nothing", [version]);
      console.log(`baseline contains ${version}`);
      continue;
    }
    const sql = await readFile(join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public.schema_migrations(version) values ($1)", [version]);
      await client.query("commit");
      console.log(`applied ${version}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally { client.release(); }
  }
} finally { await pool.end(); }
