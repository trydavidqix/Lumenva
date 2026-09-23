"use server";

import { signupSchema, type SignupInput } from "@/lib/auth/schemas";

export type SignUpResult =
  | { ok: true }
  | {
      ok: false;
      error: "validation_error" | "rate_limited" | "signup_failed" | "use_firebase_client";
      details?: Record<string, unknown>;
    };

/**
 * Inert Server Action for sign up.
 * In F4, sign up must be performed client-side using the Firebase browser client.
 */
export async function signUp(input: SignupInput): Promise<SignUpResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  return { ok: false, error: "use_firebase_client" };
}
