import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/auth/types";

vi.mock("@/lib/auth/server", () => ({ loadAuthUser: vi.fn(), resolveActiveOrg: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

function setup(target: { id: string; user_id: string; role: string; revoked_at: string | null } | null, adminCount = 2) {
  const updates: Array<Record<string, unknown>> = [];
  const chain = {
    eq: () => chain,
    is: () => Promise.resolve({ count: adminCount, error: null }),
    maybeSingle: () => Promise.resolve({ data: target, error: null }),
  };
  vi.mocked(loadAuthUser).mockResolvedValue({
    id: ADMIN_ID,
    email: "admin@example.com",
    full_name: null,
    avatar_url: null,
    is_platform_admin: false,
    organizations: [{ organization_id: ORG_ID, organization_name: "Org", role: "admin" }],
  } as AuthUser);
  vi.mocked(resolveActiveOrg).mockResolvedValue({ orgId: ORG_ID, name: "Org", role: "admin" });
  vi.mocked(createClient).mockResolvedValue({
    from: () => ({
      select: (_c: string, opts?: { count?: string }) => opts?.count ? chain : chain,
      update: (values: Record<string, unknown>) => ({ eq: () => { updates.push(values); return Promise.resolve({ error: null }); } }),
    }),
    rpc: async () => ({ data: "admin", error: null }),
  } as never);
  return updates;
}

const req = new NextRequest(`http://localhost/api/v1/team/${TARGET_ID}`, { method: "POST" });
const params = { params: Promise.resolve({ user_id: TARGET_ID }) };

beforeEach(() => vi.clearAllMocks());

describe("POST /api/v1/team/[user_id]/revoke", () => {
  it("impede auto-revogação", async () => {
    const { POST } = await import("@/app/api/v1/team/[user_id]/revoke/route");
    const selfParams = { params: Promise.resolve({ user_id: ADMIN_ID }) };
    setup(null);
    const res = await POST(req, selfParams);
    expect(res.status).toBe(409);
  });

  it("impede revogar o último admin sem write", async () => {
    const updates = setup({ id: MEMBERSHIP_ID, user_id: TARGET_ID, role: "admin", revoked_at: null }, 1);
    const { POST } = await import("@/app/api/v1/team/[user_id]/revoke/route");
    const res = await POST(req, params);
    expect(res.status).toBe(409);
    expect(updates).toHaveLength(0);
  });

  it("é idempotente para membro já revogado", async () => {
    const updates = setup({ id: MEMBERSHIP_ID, user_id: TARGET_ID, role: "agent", revoked_at: "2026-01-01T00:00:00.000Z" });
    const { POST } = await import("@/app/api/v1/team/[user_id]/revoke/route");
    const res = await POST(req, params);
    expect(res.status).toBe(200);
    expect((await res.json()).data.already_revoked).toBe(true);
    expect(updates).toHaveLength(0);
    expect(audit).not.toHaveBeenCalled();
  });

  it("revoga e audita member.revoked", async () => {
    const updates = setup({ id: MEMBERSHIP_ID, user_id: TARGET_ID, role: "agent", revoked_at: null });
    const { POST } = await import("@/app/api/v1/team/[user_id]/revoke/route");
    const res = await POST(req, params);
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(vi.mocked(audit).mock.calls[0]?.[0]).toMatchObject({ action: "member.revoked", actorUserId: ADMIN_ID, organizationId: ORG_ID, resourceId: MEMBERSHIP_ID });
  });
});
