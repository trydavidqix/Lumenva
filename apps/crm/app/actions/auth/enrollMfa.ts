"use server";

export type EnrollMfaResult =
  | { ok: true; factor_id: string; qr_data_url: string; uri: string; secret: string }
  | { ok: false; error: "enroll_failed" | "mfa_not_supported"; message?: string };

/**
 * MFA is not required in F4. This action is inert and gracefully returns an error.
 */
export async function enrollMfa(): Promise<EnrollMfaResult> {
  return { ok: false, error: "mfa_not_supported", message: "MFA is not supported in this version." };
}
