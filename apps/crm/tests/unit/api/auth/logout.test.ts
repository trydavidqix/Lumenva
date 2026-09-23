import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../../../../app/api/auth/logout/route";
import { NextRequest } from "next/server";
import { getServerSession, revokeRefreshTokens } from "../../../../lib/firebase/server";
import { cookies } from "next/headers";

vi.mock("../../../../lib/firebase/server", () => ({
  getServerSession: vi.fn(),
  revokeRefreshTokens: vi.fn(),
  FIREBASE_SESSION_COOKIE: "fb-session-auth",
}));

const deleteCookieMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    delete: deleteCookieMock,
  })),
}));

describe("Logout API POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes tokens and deletes cookie if session exists", async () => {
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
    });
    (getServerSession as any).mockResolvedValueOnce({ uid: "user-123" });
    (revokeRefreshTokens as any).mockResolvedValueOnce(undefined);

    const res = await POST(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("http://localhost/login");

    expect(revokeRefreshTokens).toHaveBeenCalledWith("user-123");
    expect(deleteCookieMock).toHaveBeenCalledWith("fb-session-auth");
  });

  it("deletes cookie even if no session exists", async () => {
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
    });
    (getServerSession as any).mockResolvedValueOnce(null);

    const res = await POST(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("http://localhost/login");

    expect(revokeRefreshTokens).not.toHaveBeenCalled();
    expect(deleteCookieMock).toHaveBeenCalledWith("fb-session-auth");
  });

  it("deletes cookie and redirects on error", async () => {
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
    });
    (getServerSession as any).mockRejectedValueOnce(new Error("API Error"));

    const res = await POST(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("http://localhost/login");
    expect(deleteCookieMock).toHaveBeenCalledWith("fb-session-auth");
  });
});
