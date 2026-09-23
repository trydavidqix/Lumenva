"use server";

import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/auth/schemas";

export type RequestPasswordResetResult =
  | { ok: true }
  | {
      ok: false;
      error: "validation_error" | "rate_limited" | "request_failed" | "use_firebase_client";
      details?: Record<string, unknown>;
    };

/**
 * Inert Server Action for password reset request.
 * In F4, password reset must be performed client-side using the Firebase browser client.
 */
export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<RequestPasswordResetResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  return { ok: false, error: "use_firebase_client" };
}
