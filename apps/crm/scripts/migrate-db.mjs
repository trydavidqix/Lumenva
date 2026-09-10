import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
if (!url) throw new Error("DATABASE_URL ou SUPABASE_DB_URL é obrigatório");
const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "supabase", "migrations");
const pool = new pg.Pool({ connectionString: url });
try {
  await pool.query("create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const { rowCount } = await pool.query("select 1 from public.schema_migrations where version = $1", [version]);
    if (rowCount) continue;
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
