import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const signInWithEmailAndPasswordMock = vi.fn();
const signInWithPopupMock = vi.fn();
const getIdTokenMock = vi.fn();

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: class {
    addScope() {}
    setCustomParameters() {}
  },
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailAndPasswordMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
}));

import { signInWithEmail, signInWithGoogle } from "../../../lib/firebase/client";

describe("Firebase Client Auth Wrapper", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    signInWithEmailAndPasswordMock.mockReset();
    signInWithPopupMock.mockReset();
    getIdTokenMock.mockReset();

    // Reset environment variables for predictable initialization if needed
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-api-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signInWithEmail sends ID token to backend session endpoint and does NOT return the token", async () => {
    getIdTokenMock.mockResolvedValueOnce("secret-id-token");
    signInWithEmailAndPasswordMock.mockResolvedValueOnce({
      user: { getIdToken: getIdTokenMock },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await signInWithEmail("test@example.com", "password123");

    // 1. Firebase sign-in was called
    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      expect.anything(),
      "test@example.com",
      "password123"
    );

    // 2. Fetch was called with POST to /api/auth/session and the token
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "secret-id-token" }),
    });

    // 3. The raw token is NOT in the result
    expect(result).toEqual({ ok: true });
  });

  it("signInWithGoogle sends ID token to backend session endpoint", async () => {
    getIdTokenMock.mockResolvedValueOnce("secret-google-token");
    signInWithPopupMock.mockResolvedValueOnce({
      user: { getIdToken: getIdTokenMock },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await signInWithGoogle();

    expect(signInWithPopupMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "secret-google-token" }),
    });
    expect(result).toEqual({ ok: true });
  });

  it("handles Firebase errors without leaking tokens", async () => {
    signInWithEmailAndPasswordMock.mockRejectedValueOnce({
      code: "auth/invalid-credential",
      message: "Firebase errored",
    });

    const result = await signInWithEmail("bad@example.com", "wrong");

    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles backend rejection", async () => {
    getIdTokenMock.mockResolvedValueOnce("token");
    signInWithEmailAndPasswordMock.mockResolvedValueOnce({
      user: { getIdToken: getIdTokenMock },
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await signInWithEmail("test@example.com", "password");

    expect(result).toEqual({ ok: false, error: "session_creation_failed" });
  });
});
