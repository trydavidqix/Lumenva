import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { claimActiveSession } from "./postgres-session-supersession";

describe("durable session supersession CAS", () => {
  it("permite apenas um vencedor em dois processos distintos", async () => {
    const url = process.env.SESSION_DATABASE_URL;
    if (!url) return;
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    await pool.query(`CREATE TABLE IF NOT EXISTS hermes_session_supersession (organization_id text PRIMARY KEY, active_session_id text NOT NULL, version integer NOT NULL)`);
    await pool.query("DELETE FROM hermes_session_supersession WHERE organization_id=$1", ["org-process-cas"]);
    await pool.query("INSERT INTO hermes_session_supersession VALUES ($1,$2,$3)", ["org-process-cas", "", 0]);
    const script = `(async () => { const pg = require("pg"); const p = new pg.Pool({connectionString: process.env.DATABASE_URL}); const r = await p.query("UPDATE hermes_session_supersession SET active_session_id=$1, version=version+1 WHERE organization_id=$2 AND version=$3 AND (active_session_id IS NULL OR active_session_id='') RETURNING active_session_id,version", [process.argv[1], "org-process-cas", 0]); console.log(JSON.stringify({process: process.argv[1], won: r.rowCount === 1})); await p.end(); })();`;
    const run = (sessionId: string) => new Promise<string>((resolve, reject) => { const child = spawn(process.execPath, ["-e", script, sessionId], { env: { ...process.env, DATABASE_URL: url }, stdio: ["ignore", "pipe", "pipe"], cwd: process.cwd() + "/apps/crm" }); let out = ""; let err = ""; child.stdout.on("data", (chunk) => { out += chunk; }); child.stderr.on("data", (chunk) => { err += chunk; }); child.on("error", reject); child.on("close", (code) => code === 0 ? resolve(out.trim()) : reject(new Error(`worker_exit_${code}:${err}`))); });
    const outputs = await Promise.all([run("process-a"), run("process-b")]); console.log(outputs.join("\n"));
    expect(outputs.filter((output) => JSON.parse(output).won)).toHaveLength(1);
    expect(outputs.filter((output) => !JSON.parse(output).won)).toHaveLength(1);
    expect((await pool.query("SELECT active_session_id,version FROM hermes_session_supersession WHERE organization_id=$1", ["org-process-cas"])).rows[0].version).toBe(1);
    await pool.end();
  });

  it("expõe a mesma decisão CAS no adapter TypeScript", async () => {
    const url = process.env.SESSION_DATABASE_URL;
    if (!url) return;
    const { Pool } = await import("pg"); const pool = new Pool({ connectionString: url });
    const db={query:(text:string,values?:unknown[])=>pool.query(text,values)};
    await pool.query("DELETE FROM hermes_session_supersession WHERE organization_id=$1", ["org-ts-cas"]); await pool.query("INSERT INTO hermes_session_supersession VALUES ($1,$2,$3)", ["org-ts-cas", "", 0]);
    const r=await Promise.allSettled([claimActiveSession(db,"org-ts-cas","s1",0),claimActiveSession(db,"org-ts-cas","s2",0)]); expect(r.filter(x=>x.status==="fulfilled")).toHaveLength(1); expect(r.filter(x=>x.status==="rejected")).toHaveLength(1); await pool.end();
  });
});
