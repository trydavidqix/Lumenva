import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { signInWithPassword } from "@/app/actions/auth/signInWithPassword";
import { enrollMfa } from "@/app/actions/auth/enrollMfa";
import { confirmMfaEnroll } from "@/app/actions/auth/confirmMfaEnroll";
import { verifyMfa } from "@/app/actions/auth/verifyMfa";
import { regenerateRecoveryCodes } from "@/app/actions/settings/regenerateRecoveryCodes";
import { requestPasswordReset } from "@/app/actions/auth/requestPasswordReset";
import { signUp } from "@/app/actions/auth/signUp";
import { updatePassword } from "@/app/actions/auth/updatePassword";

describe("Task 5 Legacy Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Inert client-side and MFA actions", () => {
    it("should return use_firebase_client for auth flow actions", async () => {
      // Providing valid inputs to pass validation_error
      const signInRes = await signInWithPassword({ email: "test@example.com", password: "Password123!" });
      expect(signInRes.ok).toBe(false);
      if (!signInRes.ok) expect(signInRes.error).toBe("use_firebase_client");

      const signUpRes = await signUp({
        email: "test@example.com",
        password: "Password123!",
        password_confirm: "Password123!",
        org_name: "Acme Corp Ltd."
      });
      expect(signUpRes.ok).toBe(false);
      if (!signUpRes.ok) expect(signUpRes.error).toBe("use_firebase_client");

      const resetRes = await requestPasswordReset({ email: "test@example.com" });
      expect(resetRes.ok).toBe(false);
      if (!resetRes.ok) expect(resetRes.error).toBe("use_firebase_client");

      const updateRes = await updatePassword({
        password: "Password123!",
        password_confirm: "Password123!",
        mfa_code: "123456"
      });
      expect(updateRes.ok).toBe(false);
      if (!updateRes.ok) expect(updateRes.error).toBe("use_firebase_client");
    });

    it("should return mfa_not_supported for MFA actions", async () => {
      const enrollRes = await enrollMfa();
      expect(enrollRes.ok).toBe(false);
      if (!enrollRes.ok) expect(enrollRes.error).toBe("mfa_not_supported");

      const confirmRes = await confirmMfaEnroll("123456", "factor-id");
      expect(confirmRes.ok).toBe(false);
      if (!confirmRes.ok) expect(confirmRes.error).toBe("mfa_not_supported");

      const verifyRes = await verifyMfa("123456");
      expect(verifyRes.ok).toBe(false);
      if (!verifyRes.ok) expect(verifyRes.error).toBe("mfa_not_supported");

      const regenRes = await regenerateRecoveryCodes();
      expect(regenRes.ok).toBe(false);
      if (!regenRes.ok) expect(regenRes.error).toBe("mfa_not_supported");
    });
  });
});
