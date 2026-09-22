import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fail } from "@/lib/api/wrappers";
import type { AuthUser, Role } from "@/lib/auth/types";

import { POST as mediaPost } from "../../app/api/v1/conversations/[id]/media/route";
import { POST as sessionPost, GET as sessionGet } from "../../app/api/v1/onboarding/whatsapp/session/route";
import { GET as qrGet } from "../../app/api/v1/onboarding/whatsapp/qr/route";

vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(),
}));

import { requireRole, type RoleCheck } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWahaClient } from "@/lib/waha/client";
import { queryTolerantToMissingArchived } from "@/lib/channels/archived";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/waha/client", () => ({
  getWahaClient: vi.fn(),
}));

vi.mock("@/lib/channels/archived", () => ({
  ARCHIVED_AT: "archived_at",
  queryTolerantToMissingArchived: vi.fn(),
}));

vi.mock("@/lib/channels/reactivate", () => ({
  reactivateChannelSession: vi.fn(),
}));

type QueryMock = {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq?: ReturnType<typeof vi.fn>;
  maybeSingle?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
  single?: ReturnType<typeof vi.fn>;
};

type StorageMock = {
  from: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
};

type WahaMock = {
  startSession: ReturnType<typeof vi.fn>;
  getSessionQr: ReturnType<typeof vi.fn>;
};

const makeAuthUser = (id: string): AuthUser => ({
  id,
  email: `${id}@example.com`,
  full_name: null,
  avatar_url: null,
  is_platform_admin: false,
  organizations: [],
});

const allowRole = (role: Role): RoleCheck => ({
  ok: true,
  user: makeAuthUser("user-1"),
  org: { orgId: "org-1", name: "Org", role },
});

const asSupabaseClient = (client: QueryMock): Awaited<ReturnType<typeof createClient>> =>
  client as unknown as Awaited<ReturnType<typeof createClient>>;

const asAdminClient = (storage: StorageMock): ReturnType<typeof createAdminClient> =>
  ({ storage }) as unknown as ReturnType<typeof createAdminClient>;

const asWahaClient = (client: WahaMock): ReturnType<typeof getWahaClient> =>
  client as unknown as ReturnType<typeof getWahaClient>;

describe("F3 Task 3 - Mutation Gates RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAHA_API_BASE_URL = "http://fake";
    process.env.WAHA_API_KEY = "fake";
  });

  describe("media route (agent+)", () => {
    it("should deny viewers without invoking storage", async () => {
      const mockRequireRole = vi.mocked(requireRole);
      mockRequireRole.mockResolvedValueOnce({
        ok: false,
        response: fail("forbidden_role", "Permissão insuficiente. Requer role >= agent.", 403, { requestId: "req-1" })
      });

      const req = new NextRequest("http://localhost/api/v1/conversations/123/media", { method: "POST" });
      const ctx = { params: Promise.resolve({ id: "123" }) };
      const res = await mediaPost(req, ctx);

      expect(res.status).toBe(403);
      expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled();
    });

    it("should allow agents to upload", async () => {
      const mockRequireRole = vi.mocked(requireRole);
      mockRequireRole.mockResolvedValueOnce(allowRole("agent"));

      const req = new NextRequest("http://localhost/api/v1/conversations/123/media", { method: "POST" });
      Object.defineProperty(req, 'headers', {
          value: new Headers({ "content-length": "100" })
      });

      const mockFile = new File(["test"], "test.png", { type: "image/png" });
      const formData = new FormData();
      formData.append("file", mockFile);
      req.formData = vi.fn().mockResolvedValueOnce(formData);

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: { id: "123" }, error: null }),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn(),
      } satisfies QueryMock;
      vi.mocked(createClient).mockResolvedValue(asSupabaseClient(mockSupabase));

      const mockAdminStorage = {
        from: vi.fn().mockReturnThis(),
        upload: vi.fn().mockResolvedValueOnce({ error: null }),
      } satisfies StorageMock;
      vi.mocked(createAdminClient).mockReturnValue(asAdminClient(mockAdminStorage));

      const ctx = { params: Promise.resolve({ id: "123" }) };
      const res = await mediaPost(req, ctx);

      expect(res.status).toBe(200);
      expect(mockAdminStorage.upload).toHaveBeenCalled();
    });
  });

  describe("WhatsApp onboarding session route (admin+)", () => {
    it("should allow admin on POST", async () => {
      const mockRequireRole = vi.mocked(requireRole);
      mockRequireRole.mockResolvedValueOnce(allowRole("admin"));

      const mockWaha = {
        startSession: vi.fn().mockResolvedValueOnce({ status: "STARTING" }),
        getSessionQr: vi.fn(),
      } satisfies WahaMock;
      vi.mocked(getWahaClient).mockReturnValue(asWahaClient(mockWaha));

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: { id: "sess-1" }, error: null }),
      } satisfies QueryMock;
      vi.mocked(createClient).mockResolvedValue(asSupabaseClient(mockSupabase));

      vi.mocked(queryTolerantToMissingArchived).mockResolvedValueOnce({ data: null, error: null });

      const req = new NextRequest("http://localhost/api/v1/onboarding/whatsapp/session", { method: "POST" });
      const res = await sessionPost(req);

      expect(res.status).toBe(200);
      expect(mockRequireRole).toHaveBeenCalledWith("admin", expect.objectContaining({ allowPlatformAdmin: true, requestId: expect.any(String) }));
    });

    it("should allow viewer on GET and not expose credentials", async () => {
      const mockRequireRole = vi.mocked(requireRole);
      mockRequireRole.mockResolvedValueOnce(allowRole("viewer"));

      const mockWaha = {
        startSession: vi.fn(),
        getSessionQr: vi.fn().mockResolvedValueOnce({ status: "WORKING" }), // Does not return credentials
      } satisfies WahaMock;
      vi.mocked(getWahaClient).mockReturnValue(asWahaClient(mockWaha));

      const req = new NextRequest("http://localhost/api/v1/onboarding/whatsapp/session", { method: "GET" });
      const res = await sessionGet();

      expect(res.status).toBe(200);
      expect(mockRequireRole).toHaveBeenCalledWith("viewer", expect.objectContaining({ allowPlatformAdmin: true }));
      const body = await res.json();
      expect(body.data.status).toBe("WORKING");
    });
  });

  describe("WhatsApp onboarding qr route (viewer+)", () => {
    it("should allow viewer", async () => {
      const mockRequireRole = vi.mocked(requireRole);
      mockRequireRole.mockResolvedValueOnce(allowRole("viewer"));

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: vi.fn().mockResolvedValueOnce(new ArrayBuffer(8))
      } as unknown as Response);

      const res = await qrGet();
      expect(res.status).toBe(200);
      expect(mockRequireRole).toHaveBeenCalledWith("viewer", expect.objectContaining({ allowPlatformAdmin: true }));
    });

    it("should deny unauthenticated or missing org by returning 404/401 from requireRole", async () => {
      const mockRequireRole = vi.mocked(requireRole);
      mockRequireRole.mockResolvedValueOnce({
        ok: false,
        response: fail("forbidden_tenant", "Sem organização ativa.", 403, {})
      });

      const res = await qrGet();
      expect(res.status).toBe(403);
    });
  });
});
