/**
 * Fase 6 gap-fill: two of the plan's required unit tests had no code
 * behind them — "perfil revogado não pode ser usado" and "voz de outro
 * tenant é rejeitada". `openvoice-adapter.ts` can request/revoke a clone,
 * but nothing checked ownership or revocation status before a
 * `cloneProfileId` reached synthesis. This module is that check.
 */

export type CloneProfileStatus = "active" | "revoked";

export interface CloneProfileRecord {
  cloneProfileId: string;
  organizationId: string;
  status: CloneProfileStatus;
}

/** Seam to wherever clone profile records actually live (DB row today, in-memory map in tests). */
export interface CloneProfileLookup {
  findCloneProfile(cloneProfileId: string): Promise<CloneProfileRecord | null>;
}

/**
 * Throws unless the profile exists, belongs to `organizationId`, and is
 * still active. Call this before ever handing a `cloneProfileId` to
 * `createOpenVoiceTtsPort` — an unknown, revoked, or cross-tenant profile
 * must never reach synthesis.
 */
export async function assertCloneProfileUsable(
  lookup: CloneProfileLookup,
  organizationId: string,
  cloneProfileId: string,
): Promise<void> {
  const record = await lookup.findCloneProfile(cloneProfileId);
  if (record === null) {
    throw new Error(`[voice] clone profile "${cloneProfileId}" is unknown`);
  }
  if (record.organizationId !== organizationId) {
    throw new Error(`[voice] clone profile "${cloneProfileId}" belongs to a different organization`);
  }
  if (record.status === "revoked") {
    throw new Error(`[voice] clone profile "${cloneProfileId}" has been revoked`);
  }
}

/**
 * Non-throwing form for `fallback-chain.ts`'s `cloneAvailable` input —
 * the fallback chain wants a boolean, not an exception, when deciding
 * whether to fall through to Kokoro/Piper.
 */
export async function isCloneProfileUsable(
  lookup: CloneProfileLookup,
  organizationId: string,
  cloneProfileId: string,
): Promise<boolean> {
  try {
    await assertCloneProfileUsable(lookup, organizationId, cloneProfileId);
    return true;
  } catch {
    return false;
  }
}
