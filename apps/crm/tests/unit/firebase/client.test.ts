import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const signInWithEmailAndPasswordMock = vi.fn();
const signInWithPopupMock = vi.fn();
const connectAuthEmulatorMock = vi.fn();
const getIdTokenMock = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  connectAuthEmulator: (...args: unknown[]) => connectAuthEmulatorMock(...args),
  GoogleAuthProvider: class {
    addScope() {}
    setCustomParameters() {}
  },
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailAndPasswordMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
}));

let signInWithEmail: typeof import("../../../lib/firebase/client")["signInWithEmail"];
let signInWithGoogle: typeof import("../../../lib/firebase/client")["signInWithGoogle"];

describe("Firebase Client Auth Wrapper", () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    signInWithEmailAndPasswordMock.mockReset();
    signInWithPopupMock.mockReset();
    connectAuthEmulatorMock.mockReset();
    getIdTokenMock.mockReset();

    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "demo-lumenva-e2e");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
    vi.resetModules();
    ({ signInWithEmail, signInWithGoogle } = await import("../../../lib/firebase/client"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("connects to the Firebase Auth emulator only when configured", async () => {
    expect(connectAuthEmulatorMock).toHaveBeenCalledWith(
      expect.anything(),
      "http://127.0.0.1:9099",
      { disableWarnings: true },
    );

    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST", "");
    vi.resetModules();
    await import("../../../lib/firebase/client");

    expect(connectAuthEmulatorMock).toHaveBeenCalledTimes(1);

    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "lumenva-production");
    vi.resetModules();
    await expect(import("../../../lib/firebase/client")).rejects.toThrow(
      "Firebase Auth Emulator só pode ser usado com um projeto demo.",
    );
  });

  it("signInWithEmail sends ID token to backend session endpoint and does NOT return the token", async () => {
    getIdTokenMock.mockResolvedValueOnce("secret-id-token");
    signInWithEmailAndPasswordMock.mockResolvedValueOnce({
      user: { getIdToken: getIdTokenMock },
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

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
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

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
    signInWithEmailAndPasswordMock.mockRejectedValueOnce(Object.assign(new Error("Firebase errored"), {
      code: "auth/invalid-credential"
    }));

    const result = await signInWithEmail("bad@example.com", "wrong");

    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles backend rejection", async () => {
    getIdTokenMock.mockResolvedValueOnce("token");
    signInWithEmailAndPasswordMock.mockResolvedValueOnce({
      user: { getIdToken: getIdTokenMock },
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const result = await signInWithEmail("test@example.com", "password");

    expect(result).toEqual({ ok: false, error: "session_creation_failed" });
  });
});
