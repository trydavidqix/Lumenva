"use server";

import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/auth/schemas";

export type UpdatePasswordResult = {
  ok: false;
  error:
    | "validation_error"
    | "session_expired"
    | "same_password"
    | "update_failed"
    | "mfa_required"
    | "mfa_invalid"
    | "use_firebase_client";
  details?: Record<string, unknown>;
};

/**
 * Inert Server Action for password update.
 * In F4, password updates within recovery must be handled by Firebase client.
 */
export async function updatePassword(
  input: ResetPasswordInput,
): Promise<UpdatePasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  return { ok: false, error: "use_firebase_client" };
}
