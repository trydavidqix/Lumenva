import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/wrappers";

import { POST as mediaPost } from "../../app/api/v1/conversations/[id]/media/route";
import { POST as sessionPost, GET as sessionGet } from "../../app/api/v1/onboarding/whatsapp/session/route";
import { GET as qrGet } from "../../app/api/v1/onboarding/whatsapp/qr/route";

vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(),
}));

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

describe("F3 Task 3 - Mutation Gates RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAHA_API_BASE_URL = "http://fake";
    process.env.WAHA_API_KEY = "fake";
  });

  describe("media route (agent+)", () => {
    it("should deny viewers without invoking storage", async () => {
      const mockRequireRole = requireRole as any;
      mockRequireRole.mockResolvedValueOnce({
        ok: false,
        response: fail("forbidden_role", "Permissão insuficiente. Requer role >= agent.", 403, { requestId: "req-1" })
      });

      const req = new NextRequest("http://localhost/api/v1/conversations/123/media", { method: "POST" });
      const ctx = { params: Promise.resolve({ id: "123" }) };
      const res = await mediaPost(req, ctx);

      expect(res.status).toBe(403);
      const adminClient = createAdminClient as any;
      expect(adminClient).not.toHaveBeenCalled();
    });

    it("should allow agents to upload", async () => {
      const mockRequireRole = requireRole as any;
      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        user: { id: "user-1", organizations: [] },
        org: { orgId: "org-1", role: "agent" }
      });

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
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const mockAdminStorage = {
        from: vi.fn().mockReturnThis(),
        upload: vi.fn().mockResolvedValueOnce({ error: null })
      };
      (createAdminClient as any).mockReturnValue({ storage: mockAdminStorage });

      const ctx = { params: Promise.resolve({ id: "123" }) };
      const res = await mediaPost(req, ctx);

      expect(res.status).toBe(200);
      expect(mockAdminStorage.upload).toHaveBeenCalled();
    });
  });

  describe("WhatsApp onboarding session route (admin+)", () => {
    it("should allow admin on POST", async () => {
      const mockRequireRole = requireRole as any;
      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        user: { id: "user-1", organizations: [] },
        org: { orgId: "org-1", role: "admin" }
      });

      const { getWahaClient } = await import("@/lib/waha/client");
      const mockWaha = {
        startSession: vi.fn().mockResolvedValueOnce({ status: "STARTING" })
      };
      (getWahaClient as any).mockReturnValue(mockWaha);

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: { id: "sess-1" }, error: null })
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const { queryTolerantToMissingArchived } = await import("@/lib/channels/archived");
      (queryTolerantToMissingArchived as any).mockResolvedValueOnce({ data: null, error: null });

      const req = new NextRequest("http://localhost/api/v1/onboarding/whatsapp/session", { method: "POST" });
      const res = await sessionPost(req);

      expect(res.status).toBe(200);
      expect(mockRequireRole).toHaveBeenCalledWith("admin", expect.objectContaining({ allowPlatformAdmin: true, requestId: expect.any(String) }));
    });

    it("should allow viewer on GET and not expose credentials", async () => {
      const mockRequireRole = requireRole as any;
      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        user: { id: "user-1", organizations: [] },
        org: { orgId: "org-1", role: "viewer" }
      });

      const { getWahaClient } = await import("@/lib/waha/client");
      const mockWaha = {
        getSessionQr: vi.fn().mockResolvedValueOnce({ status: "WORKING" }) // Does not return credentials
      };
      (getWahaClient as any).mockReturnValue(mockWaha);

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
      const mockRequireRole = requireRole as any;
      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        user: { id: "user-1", organizations: [] },
        org: { orgId: "org-1", role: "viewer" }
      });

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
      const mockRequireRole = requireRole as any;
      mockRequireRole.mockResolvedValueOnce({
        ok: false,
        response: fail("forbidden_tenant", "Sem organização ativa.", 403, {})
      });

      const res = await qrGet();
      expect(res.status).toBe(403);
    });
  });
});
