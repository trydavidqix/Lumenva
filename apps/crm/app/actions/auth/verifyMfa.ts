"use server";

export type VerifyMfaResult =
  | { ok: false; error: "mfa_invalid" | "mfa_not_supported" }
  | { ok: false; error: "mfa_locked"; retry_in_seconds: number };

/**
 * MFA is not required in F4. This action is inert.
 */
export async function verifyMfa(code: string, next?: string): Promise<VerifyMfaResult> {
  return { ok: false, error: "mfa_not_supported" };
}
