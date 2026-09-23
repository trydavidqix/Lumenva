import { describe, it, expect, vi, beforeEach } from "vitest";

const createSessionCookieMock = vi.fn();
const verifySessionCookieMock = vi.fn();
const revokeRefreshTokensMock = vi.fn();

vi.mock("@lumenva/db/gcp/firebase-auth", () => ({
  initFirebaseAuth: vi.fn(() => ({
    createSessionCookie: createSessionCookieMock,
    verifySessionCookie: verifySessionCookieMock,
    revokeRefreshTokens: revokeRefreshTokensMock,
  })),
}));

const mockGetCookie = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: mockGetCookie,
  })),
}));

import {
  createSessionCookie,
  verifySessionCookie,
  revokeRefreshTokens,
  getServerSession,
  FIREBASE_SESSION_COOKIE,
  SESSION_EXPIRATION_MS,
} from "../../../lib/firebase/server";

describe("Firebase Server API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createSessionCookie calls auth with correct params", async () => {
    createSessionCookieMock.mockResolvedValueOnce("new-cookie");
    const result = await createSessionCookie("id-token");
    expect(createSessionCookieMock).toHaveBeenCalledWith("id-token", {
      expiresIn: SESSION_EXPIRATION_MS,
    });
    expect(result).toBe("new-cookie");
  });

  it("verifySessionCookie checks revoked status", async () => {
    verifySessionCookieMock.mockResolvedValueOnce({ uid: "user-123" });
    const result = await verifySessionCookie("sess-cookie");
    expect(verifySessionCookieMock).toHaveBeenCalledWith("sess-cookie", true);
    expect(result).toEqual({ uid: "user-123" });
  });

  it("revokeRefreshTokens calls auth API", async () => {
    revokeRefreshTokensMock.mockResolvedValueOnce(undefined);
    await revokeRefreshTokens("user-123");
    expect(revokeRefreshTokensMock).toHaveBeenCalledWith("user-123");
  });

  it("getServerSession returns null if no cookie", async () => {
    mockGetCookie.mockReturnValueOnce(undefined);
    const result = await getServerSession();
    expect(result).toBeNull();
  });

  it("getServerSession returns decoded claims if valid", async () => {
    mockGetCookie.mockReturnValueOnce({ value: "valid-cookie" });
    verifySessionCookieMock.mockResolvedValueOnce({ uid: "user-123" });

    const result = await getServerSession();
    expect(verifySessionCookieMock).toHaveBeenCalledWith("valid-cookie", true);
    expect(result).toEqual({ uid: "user-123" });
  });

  it("getServerSession returns null if verification fails", async () => {
    mockGetCookie.mockReturnValueOnce({ value: "invalid-cookie" });
    verifySessionCookieMock.mockRejectedValueOnce(new Error("Revoked"));

    const result = await getServerSession();
    expect(result).toBeNull();
  });
});
