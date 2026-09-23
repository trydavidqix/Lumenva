import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAuthUserMock = vi.hoisted(() => vi.fn());
const resolveActiveOrgMock = vi.hoisted(() => vi.fn());
const resolvePlatformAdminMock = vi.hoisted(() => vi.fn());
const createAdminClientMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: loadAuthUserMock,
  resolveActiveOrg: resolveActiveOrgMock,
}));
vi.mock("@/lib/auth/requirePlatformAdmin", () => ({
  resolvePlatformAdmin: resolvePlatformAdminMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

import { requireRole } from "./require-role";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

function roleQuery(role: string | null) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({
    data: role ? { role } : null,
    error: null,
  }));
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAuthUserMock.mockResolvedValue({
    id: USER_ID,
    email: "user@example.com",
    full_name: null,
    avatar_url: null,
    is_platform_admin: false,
    organizations: [{ organization_id: ORG_ID, organization_name: "Org", role: "agent" }],
  });
  resolveActiveOrgMock.mockResolvedValue({ orgId: ORG_ID, name: "Org", role: "agent" });
  resolvePlatformAdminMock.mockResolvedValue({ ok: false, reason: "forbidden" });
  createClientMock.mockImplementation(() => {
    throw new Error("Supabase Auth/RLS role RPC must not be consulted for Firebase authorization");
  });
  createAdminClientMock.mockReturnValue({
    from: vi.fn(() => roleQuery("manager")),
  });
});

describe("requireRole Firebase authorization", () => {
  it("reads the effective role for the mapped internal user without Supabase Auth", async () => {
    const result = await requireRole("manager");

    expect(result.ok).toBe(true);
    expect(createAdminClientMock).toHaveBeenCalledOnce();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
