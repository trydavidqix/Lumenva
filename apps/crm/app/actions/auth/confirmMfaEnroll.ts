"use server";

export type ConfirmMfaEnrollResult =
  | { ok: true; recovery_codes: string[] }
  | { ok: false; error: "invalid_code" | "challenge_failed" | "verify_failed" | "mfa_not_supported"; message?: string };

/**
 * MFA is not required in F4. This action is inert.
 */
export async function confirmMfaEnroll(
  code: string,
  factorId: string,
): Promise<ConfirmMfaEnrollResult> {
  return { ok: false, error: "mfa_not_supported", message: "MFA is not supported in this version." };
}
