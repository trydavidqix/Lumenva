import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { ensureHealthStore, recordHealth, loadHealth } from "./resource-health";

describe("resource health persistence", () => {
 let pool: Pool; let container=""; let url="";
 beforeAll(async()=>{const {execFileSync}=await import("node:child_process"); container=execFileSync("docker",["run","-d","--rm","-e","POSTGRES_PASSWORD=postgres","-p","0:5432","postgres:16"],{encoding:"utf8"}).trim(); const port=execFileSync("docker",["port",container,"5432/tcp"],{encoding:"utf8"}).trim().split(":").pop(); url=`postgres://postgres:postgres@127.0.0.1:${port}/postgres`; for(let i=0;i<120;i++){try{pool=new Pool({connectionString:url}); await pool.query("select 1"); break;}catch{await pool?.end();await new Promise(r=>setTimeout(r,200));}} await ensureHealthStore(pool!);},40000);
 afterAll(async()=>{await pool?.end();if(container){const {execFileSync}=await import("node:child_process");execFileSync("docker",["rm","-f",container]);}});
 it("persists health across a fresh pool",async()=>{await recordHealth(pool,"org-1","linux-1",true,0.2); const fresh=new Pool({connectionString:url}); expect(await loadHealth(fresh,"org-1","linux-1")).toEqual({healthy:true,load:0.2}); await fresh.end();});
});
