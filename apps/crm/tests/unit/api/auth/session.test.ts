import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../../../../app/api/auth/session/route";
import { NextRequest } from "next/server";
import { createSessionCookie, FIREBASE_SESSION_COOKIE } from "../../../../lib/firebase/server";
import { cookies } from "next/headers";
import { initFirebaseAuth } from "@lumenva/db/gcp/firebase-auth";

vi.mock("@lumenva/db/gcp/firebase-auth", () => ({
  initFirebaseAuth: vi.fn(),
}));

vi.mock("../../../../lib/firebase/server", () => ({
  createSessionCookie: vi.fn(),
  FIREBASE_SESSION_COOKIE: "fb-session-auth",
  SESSION_EXPIRATION_MS: 432000000,
}));

const setCookieMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    set: setCookieMock,
  })),
}));

describe("Session API POST", () => {
  let mockAuth: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = {
      verifyIdToken: vi.fn(),
    };
    (initFirebaseAuth as any).mockReturnValue(mockAuth);
  });

  it("returns 401 if CSRF header is missing", async () => {
    // missing x-request-id or content-type
    const req = new NextRequest("http://localhost/api/auth/session", {
      method: "POST",
      body: JSON.stringify({}),
      headers: new Headers(), // Headers explicitly empty
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toBe("CSRF token missing");
  });

  it("returns 400 if idToken is missing", async () => {
    const req = new NextRequest("http://localhost/api/auth/session", {
      method: "POST",
      body: JSON.stringify({}),
      headers: new Headers({ "content-type": "application/json" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("invalid_request");
  });

  it("returns 401 if auth_time is too old", async () => {
    const req = new NextRequest("http://localhost/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken: "old-token" }),
      headers: new Headers({ "content-type": "application/json" }),
    });
    mockAuth.verifyIdToken.mockResolvedValueOnce({
      auth_time: new Date().getTime() / 1000 - 10 * 60, // 10 minutes ago
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toBe("Recent sign in required");
  });

  it("sets session cookie and returns ok if valid", async () => {
    const req = new NextRequest("http://localhost/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken: "valid-token" }),
      headers: new Headers({ "content-type": "application/json" }),
    });
    mockAuth.verifyIdToken.mockResolvedValueOnce({
      auth_time: new Date().getTime() / 1000, // Now
    });
    (createSessionCookie as any).mockResolvedValueOnce("new-session-cookie");

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    expect(setCookieMock).toHaveBeenCalledWith(
      "fb-session-auth",
      "new-session-cookie",
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      })
    );
  });

  it("returns 401 if error occurs during creation", async () => {
    const req = new NextRequest("http://localhost/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken: "bad-token" }),
      headers: new Headers({ "content-type": "application/json" }),
    });
    mockAuth.verifyIdToken.mockRejectedValueOnce(new Error("Invalid token"));

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
