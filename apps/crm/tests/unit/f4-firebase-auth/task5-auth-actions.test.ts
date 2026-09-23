import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Provide mocked functions that we need to spy on
const mockGetServerSession = vi.fn();
const mockRevokeRefreshTokens = vi.fn();
vi.mock("@/lib/firebase/server", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
  revokeRefreshTokens: (...args: unknown[]) => mockRevokeRefreshTokens(...args),
  FIREBASE_SESSION_COOKIE: "fb-session-auth"
}));

const mockAuthUser = { id: "test-user-id" };
const mockLoadAuthUser = vi.fn();
const mockResolveActiveOrg = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: (...args: unknown[]) => mockLoadAuthUser(...args),
  resolveActiveOrg: (...args: unknown[]) => mockResolveActiveOrg(...args),
}));

const mockAudit = vi.fn();
vi.mock("@/lib/audit", () => ({
  audit: (...args: unknown[]) => mockAudit(...args),
  hashEmail: vi.fn((e) => e),
  isServiceRoleConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: vi.fn(() => ({
      rpc: vi.fn().mockResolvedValue({ data: "manager", error: null }),
    })),
  };
});
vi.mock("@/lib/auth/requirePlatformAdmin", () => ({
  resolvePlatformAdmin: vi.fn().mockResolvedValue({ ok: false }),
}));

import { signOut } from "@/app/actions/auth/signOut";
import { signOutEverywhere } from "@/app/actions/settings/signOutEverywhere";
import { requireRole } from "@/lib/auth/require-role";
import * as nextHeaders from "next/headers";
import * as nextNav from "next/navigation";

describe("Task 5 Auth Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (nextHeaders.cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      delete: vi.fn(),
    });
    (nextHeaders.headers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: vi.fn(),
    });
  });

  describe("signOut", () => {
    it("should clear fb-session-auth and redirect", async () => {
      mockLoadAuthUser.mockResolvedValueOnce(mockAuthUser);

      const mockDelete = vi.fn();
      (nextHeaders.cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        delete: mockDelete,
      });

      await signOut();

      expect(mockDelete).toHaveBeenCalledWith("fb-session-auth");
      expect(mockDelete).toHaveBeenCalledWith("active_org");
      expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: "auth.logout",
        actorUserId: "test-user-id",
      }));
      expect(nextNav.redirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("signOutEverywhere", () => {
    it("should revoke refresh tokens for current Firebase session and redirect", async () => {
      mockGetServerSession.mockResolvedValueOnce({ uid: "firebase-uid" });
      mockLoadAuthUser.mockResolvedValueOnce(mockAuthUser);

      const mockDelete = vi.fn();
      (nextHeaders.cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        delete: mockDelete,
      });

      await signOutEverywhere();

      expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("firebase-uid");
      expect(mockDelete).toHaveBeenCalledWith("fb-session-auth");
      expect(mockDelete).toHaveBeenCalledWith("active_org");
      expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: "auth.logout",
        actorUserId: "test-user-id",
        metadata: { scope: "global" }
      }));
      expect(nextNav.redirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("requireRole", () => {
    it("should call loadAuthUser properly", async () => {
      mockLoadAuthUser.mockResolvedValueOnce({ id: "user-1", organizations: [] });
      mockResolveActiveOrg.mockResolvedValueOnce({ orgId: "org-1", name: "Org", role: "manager" });

      const res = await requireRole("viewer");

      expect(res.ok).toBe(true);
    });
  });
});
