"use server";

export type RegenerateRecoveryCodesResult =
  | { ok: true; recovery_codes: string[] }
  | { ok: false; error: string };

/**
 * MFA is not required in F4. This action is inert.
 */
export async function regenerateRecoveryCodes(): Promise<RegenerateRecoveryCodesResult> {
  return { ok: false, error: "mfa_not_supported" };
}
