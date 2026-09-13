import { describe, expect, it } from "vitest";
import { Pool } from "../../../../../apps/crm/node_modules/pg";
import { createPostgresAgentBirthAuthorityStore } from "./agent-birth-authority-store";

const databaseUrl = process.env.AGENT_BIRTH_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("Agent Birth authority Postgres integration", () => {
  it("returns only the server-owned actor and approval for the tenant/definition", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const store = createPostgresAgentBirthAuthorityStore(pool);
      await expect(store.verify({
        tenantId: "11111111-1111-1111-1111-111111111111",
        definitionId: "sales",
        definitionVersion: "1.0.0",
        origin: { actor_id: "author-1", tenant_id: "11111111-1111-1111-1111-111111111111" },
        approvalId: "approval-1",
        approverId: "reviewer-1",
      })).resolves.toMatchObject({ origin: { actor_id: "author-1" }, approval: { approval_id: "approval-1", approver_id: "reviewer-1" } });
      await expect(store.verify({
        tenantId: "11111111-1111-1111-1111-111111111111",
        definitionId: "sales",
        definitionVersion: "1.0.0",
        origin: { actor_id: "forged", tenant_id: "11111111-1111-1111-1111-111111111111" },
        approvalId: "approval-1",
        approverId: "reviewer-1",
      })).rejects.toThrow("origin_not_authoritative");
    } finally {
      await pool.end();
    }
  });
});
