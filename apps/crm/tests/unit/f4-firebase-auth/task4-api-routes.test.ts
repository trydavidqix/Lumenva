import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getRealtimeToken } from "@/app/api/v1/auth/realtime-token/route";
import { GET as getCrmSummary } from "@/app/api/v1/contacts/[id]/crm-summary/route";
import { GET as getContactsList } from "@/app/api/v1/contacts/route";
import { GET as getConversationsCounts } from "@/app/api/v1/conversations/counts/route";
import { POST as anonymizePrivacy } from "@/app/api/v1/privacy/anonymize/route";
import { loadAuthUser } from "@/lib/auth/server";
import { requireRole, type RoleCheck } from "@/lib/auth/require-role";
import { getServerSession } from "@/lib/firebase/server";
import type { AuthUser } from "@/lib/auth/types";

// Mock getServerSession
vi.mock("@/lib/firebase/server", () => ({
  getServerSession: vi.fn(),
}));

// Mock loadAuthUser
vi.mock("@/lib/auth/server", async () => {
  return {
    loadAuthUser: vi.fn(),
    resolveActiveOrg: vi.fn().mockResolvedValue({ orgId: "org-1", role: "admin" })
  };
});

// Mock requireRole
vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("Supabase auth is disabled") }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  })),
}));

// Mock handler for contacts to return a standard structure
vi.mock("@/app/api/v1/contacts/_handler", () => ({
  listContactsHandler: vi.fn().mockResolvedValue({ contacts: [], cursor: null, has_more: false }),
}));

describe("Task 4: API Routes Firebase Auth Migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/v1/auth/realtime-token", () => {
    it("should return 501 blocker since Firebase cannot issue Supabase tokens", async () => {
      vi.mocked(getServerSession).mockResolvedValue({ uid: "user-1", email: "test@test.com" } as unknown as Record<string, unknown>);
      const req = new NextRequest("http://localhost/api/v1/auth/realtime-token");
      const res = await getRealtimeToken(req);

      expect(res.status).toBe(501);
      const data = await res.json();
      expect(data.error.code).toBe("not_implemented");
    });
  });

  describe("GET /api/v1/contacts/[id]/crm-summary", () => {
    it("should return 401 if loadAuthUser returns null", async () => {
      vi.mocked(loadAuthUser).mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/v1/contacts/123/crm-summary");
      const res = await getCrmSummary(req, { params: Promise.resolve({ id: "123" }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe("unauthenticated");
    });

    it("should return 200 with summary data if authenticated", async () => {
      vi.mocked(loadAuthUser).mockResolvedValue({ id: "user-1", email: "test@example.com", is_platform_admin: false, organizations: [] } as unknown as AuthUser);
      const req = new NextRequest("http://localhost/api/v1/contacts/123/crm-summary");
      const res = await getCrmSummary(req, { params: Promise.resolve({ id: "123" }) });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/v1/contacts", () => {
    it("should return 401 if loadAuthUser returns null", async () => {
      vi.mocked(loadAuthUser).mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/v1/contacts");
      const res = await getContactsList(req);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/conversations/counts", () => {
    it("should return 401 if loadAuthUser returns null", async () => {
      vi.mocked(loadAuthUser).mockResolvedValue(null);
      const res = await getConversationsCounts();
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/privacy/anonymize", () => {
    it("should be verified via requireRole (which handles loadAuthUser internally)", async () => {
      vi.mocked(requireRole).mockResolvedValue({
        ok: false,
        response: Response.json({ error: { code: "unauthenticated" } }, { status: 401 })
      } as unknown as RoleCheck);

      const req = new NextRequest("http://localhost/api/v1/privacy/anonymize", {
        method: "POST",
        body: JSON.stringify({ contact_id: "123" })
      });
      const res = await anonymizePrivacy(req);
      expect(res.status).toBe(401);
    });
  });
});
