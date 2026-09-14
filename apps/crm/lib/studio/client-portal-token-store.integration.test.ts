import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { Pool } from "../../../../apps/crm/node_modules/pg";
import { createPostgresClientPortalTokenStore } from "./client-portal-token-store";
import type { ClientPortalToken } from "./project-spec";

const databaseUrl = process.env.STUDIO_PORTAL_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("Client portal token Postgres integration", () => {
  it("allows exactly one concurrent consume for a single-use token", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const token: ClientPortalToken = {
      token_id: "00000000-0000-0000-0000-000000000001",
      project_id: "project-1",
      organization_id: "11111111-1111-1111-1111-111111111111",
      token_hash: createHash("sha256").update("plaintext-token", "utf8").digest("hex"),
      scope: "VIEW",
      expires_at: "2026-10-01T00:00:00.000Z",
      single_use: true,
      created_by: "owner-1",
    };
    try {
      const store = createPostgresClientPortalTokenStore(pool);
      await store.issue(token);
      const results = await Promise.all(Array.from({ length: 16 }, () => store.consume({
        token: "plaintext-token",
        projectId: token.project_id,
        organizationId: token.organization_id,
        requiredScope: "VIEW",
        now: "2026-09-12T00:00:00.000Z",
      })));
      expect(results.filter(Boolean)).toHaveLength(1);
      const count = await pool.query("select count(*)::int as count from public.studio_client_portal_tokens where token_id = $1 and used_at is not null", [token.token_id]);
      expect(count.rows[0]?.count).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
