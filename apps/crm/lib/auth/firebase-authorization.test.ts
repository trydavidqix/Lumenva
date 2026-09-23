import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const createAdminClientMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/server", () => ({
  getServerSession: getServerSessionMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { loadAuthUser } from "./server";
import { resolvePlatformAdmin } from "./requirePlatformAdmin";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

function queryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function arrangeAdminQueries(options: {
  platformAdmin?: unknown;
  memberships?: unknown;
}) {
  const tables = new Map<string, Record<string, unknown>>([
    [
      "identity_user_mappings",
      queryBuilder({ data: { user_id: USER_ID, active: true }, error: null }),
    ],
    [
      "platform_admins",
      queryBuilder({ data: options.platformAdmin ?? null, error: null }),
    ],
    [
      "user_organizations",
      queryBuilder({
        data:
          options.memberships ?? [
            {
              organization_id: ORG_ID,
              role: "manager",
              organizations: { display_name: "Org" },
            },
          ],
        error: null,
      }),
    ],
  ]);

  createAdminClientMock.mockReturnValue({
    from: vi.fn((table: string) => tables.get(table)),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({
    uid: "firebase-user-a",
    email: "user@example.com",
    name: "Firebase User",
    picture: "https://example.test/avatar.png",
  });
  cookiesMock.mockReturnValue({ get: vi.fn(() => undefined) });
  createClientMock.mockImplementation(() => {
    throw new Error("Supabase Auth must not be consulted for Firebase authorization");
  });
});

describe("Firebase authorization boundary", () => {
  it("resolves tenant identity from the Firebase session, not Supabase Auth", async () => {
    arrangeAdminQueries({});

    const user = await loadAuthUser();

    expect(user).toMatchObject({
      id: USER_ID,
      email: "user@example.com",
      full_name: "Firebase User",
      avatar_url: "https://example.test/avatar.png",
      is_platform_admin: false,
    });
    expect(user?.organizations).toEqual([
      {
        organization_id: ORG_ID,
        organization_name: "Org",
        role: "manager",
      },
    ]);
    expect(getServerSessionMock).toHaveBeenCalledOnce();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("resolves platform-admin authorization from Firebase identity mapping", async () => {
    arrangeAdminQueries({
      platformAdmin: {
        user_id: USER_ID,
        scope: "full",
        mfa_required: false,
        revoked_at: null,
      },
    });

    const result = await resolvePlatformAdmin();

    expect(result).toMatchObject({
      ok: true,
      context: {
        user: { id: USER_ID, email: "user@example.com" },
        platformAdmin: { user_id: USER_ID, scope: "full", mfa_required: false },
      },
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
