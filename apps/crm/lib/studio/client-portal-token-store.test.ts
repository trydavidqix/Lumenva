import { describe, expect, it } from "vitest";
import { createPostgresClientPortalTokenStore } from "./client-portal-token-store";
import type { ClientPortalToken } from "./project-spec";

const record: ClientPortalToken = {
  token_id: "token-1",
  project_id: "project-1",
  organization_id: "org-1",
  token_hash: "a".repeat(64),
  scope: "VIEW",
  expires_at: "2026-10-01T00:00:00.000Z",
  single_use: true,
  created_by: "owner-1",
};

describe("Client portal token Postgres boundary", () => {
  it("persists only token hashes with tenant-scoped upsert", async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const db = { async query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]) { calls.push({ text, values }); return { rows: [] as T[] }; } };
    await createPostgresClientPortalTokenStore(db).issue(record);
    expect(calls[0]?.text).toContain("insert into public.studio_client_portal_tokens");
    expect(calls[0]?.text).toContain("on conflict (token_id)");
    expect(calls[0]?.values).not.toContain("plaintext-token");
  });

  it("atomically consumes single-use tokens with tenant, scope and expiry predicates", async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const db = { async query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]) { calls.push({ text, values }); return { rows: [record] as T[] }; } };
    const consumed = await createPostgresClientPortalTokenStore(db).consume({
      token: "plaintext-token", projectId: "project-1", organizationId: "org-1", requiredScope: "VIEW", now: "2026-09-12T00:00:00.000Z",
    });
    expect(consumed).toEqual(record);
    expect(calls[0]?.text).toContain("where organization_id = $1");
    expect(calls[0]?.text).toContain("and (single_use = false or used_at is null)");
    expect(calls[0]?.text).toContain("expires_at > $6::timestamptz");
  });
});
