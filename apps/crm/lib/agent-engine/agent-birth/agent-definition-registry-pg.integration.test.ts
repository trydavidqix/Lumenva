import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pg from "pg";
import { PostgresAgentDefinitionRegistry } from "./agent-definition-registry-pg";
import { InMemoryAgentBirthAuthorityStore } from "./agent-birth-authority-store";

const definition = { id:"sales", version:"1.0.0", status:"CERTIFIED" as const, identity:"Sales", mission:"Qualify", boundaries:["No send"], authority:"P0", escalation:"Human" };
function input(store: InMemoryAgentBirthAuthorityStore) { return { definition, origin:{actor_id:"author",tenant_id:"00000000-0000-4000-8000-000000000001"}, expectedTenantId:"00000000-0000-4000-8000-000000000001", approval:{approval_id:"ap-1",approver_id:"reviewer",tenant_id:"00000000-0000-4000-8000-000000000001",status:"APPROVED" as const,approved_at:"2026-09-13T00:00:00Z",policy_version:"p1"}, authorityStore:store }; }
describe("durable agent definition registry", () => {
  it("deduplicates concurrent same tenant/id/version in PostgreSQL", async () => {
    const url=process.env.DATABASE_URL; if(!url) throw new Error("DATABASE_URL required");
    const pool=new pg.Pool({connectionString:url}); const auth=new InMemoryAgentBirthAuthorityStore(); auth.addActor({actor_id:"author",tenant_id:"00000000-0000-4000-8000-000000000001",actor_type:"HUMAN",active:true}); auth.addApproval({...input(auth).approval,definition_id:"sales",definition_version:"1.0.0",author_actor_id:"author"});
    const registry=new PostgresAgentDefinitionRegistry(pool); await pool.query(readFileSync("supabase/migrations/20260913170000_0168_agent_definition_registry.sql", "utf8")); await pool.query("truncate agent_definition_registry");
    const results=await Promise.all([registry.register(input(auth)).then(()=>true).catch(()=>false),registry.register(input(auth)).then(()=>true).catch(()=>false)]);
    expect(results.filter(Boolean)).toHaveLength(1); expect(await registry.get("00000000-0000-4000-8000-000000000001","sales","1.0.0")).toMatchObject({id:"sales",version:"1.0.0"}); await pool.end();
  });
});
