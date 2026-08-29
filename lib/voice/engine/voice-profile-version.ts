import { z } from "zod";
import type { VoiceProfile } from "./contracts";
import { VoiceProfileSchema } from "./voice-profile-schema";

/**
 * A published voice profile version. Immutable once created (Fase 4 do
 * plano open-source: "configuração publicada deve ser imutável; alteração
 * de voz cria nova versão ou nova configuração auditada"). Never mutate an
 * existing entry — `publishVoiceProfileVersion` only ever appends.
 */
export interface VoiceProfileVersion {
  version: number;
  publishedAt: string;
  publishedByUserId: string;
  profile: VoiceProfile;
}

export interface VoiceProfileHistory {
  activeVersion: number | null;
  /** Append-only, ascending by version. Never remove or edit an entry — see EMPTY_VOICE_PROFILE_HISTORY. */
  versions: VoiceProfileVersion[];
}

export const EMPTY_VOICE_PROFILE_HISTORY: VoiceProfileHistory = { activeVersion: null, versions: [] };

const VoiceProfileVersionSchema = z.object({
  version: z.number().int().positive(),
  publishedAt: z.string().min(1),
  publishedByUserId: z.string().min(1),
  profile: VoiceProfileSchema,
});

const VoiceProfileHistorySchema = z.object({
  activeVersion: z.number().int().positive().nullable(),
  versions: z.array(VoiceProfileVersionSchema),
});

/** Reads back a history from untrusted storage (organizations.settings jsonb). Falls back to empty rather than throwing on absence. */
export function parseVoiceProfileHistory(input: unknown): VoiceProfileHistory {
  if (input === null || input === undefined) return EMPTY_VOICE_PROFILE_HISTORY;
  return VoiceProfileHistorySchema.parse(input);
}

/**
 * Publishes a new voice profile version. Always appends — the returned
 * history's `versions` array is the input's plus exactly one new entry;
 * every prior entry is copied unchanged. `activeVersion` moves to the new
 * entry.
 */
export function publishVoiceProfileVersion(
  history: VoiceProfileHistory,
  profile: VoiceProfile,
  publishedByUserId: string,
  publishedAt: string,
): VoiceProfileHistory {
  if (!publishedByUserId.trim()) throw new Error("[voice] publishing a voice profile version requires a publisher");
  const lastVersion = history.versions.at(-1)?.version ?? 0;
  const entry: VoiceProfileVersion = { version: lastVersion + 1, publishedAt, publishedByUserId, profile };
  return { activeVersion: entry.version, versions: [...history.versions, entry] };
}

export function getActiveVoiceProfile(history: VoiceProfileHistory): VoiceProfile | null {
  if (history.activeVersion === null) return null;
  return history.versions.find((entry) => entry.version === history.activeVersion)?.profile ?? null;
}

/**
 * Rolls back to a previously published version WITHOUT deleting or
 * rewriting history — rollback is itself a new active pointer, auditable
 * like any other publish. Throws on an unknown version rather than
 * silently doing nothing.
 */
export function activateVoiceProfileVersion(history: VoiceProfileHistory, version: number): VoiceProfileHistory {
  if (!history.versions.some((entry) => entry.version === version)) {
    throw new Error(`[voice] cannot activate unknown voice profile version ${version}`);
  }
  return { ...history, activeVersion: version };
}
