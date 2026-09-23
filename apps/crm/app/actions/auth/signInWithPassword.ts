"use server";

import { loginSchema, type LoginInput } from "@/lib/auth/schemas";

export type SignInResult = {
  ok: false;
  error: "invalid_credentials" | "rate_limited" | "validation_error" | "mfa_required" | "use_firebase_client";
  details?: Record<string, unknown>;
  challengeId?: string;
};

/**
 * Inert Server Action for sign in.
 * In F4, sign in must be performed client-side using the Firebase browser client,
 * followed by a POST to /api/auth/session with the resulting ID token.
 */
export async function signInWithPassword(
  input: LoginInput,
  next?: string,
): Promise<SignInResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  // Explicit blocker for Firebase client transition
  return { ok: false, error: "use_firebase_client" };
}
