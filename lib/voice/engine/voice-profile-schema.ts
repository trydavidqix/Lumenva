import { z } from "zod";
import { VOICE_PROFILE_PROVIDERS, type VoiceProfile } from "./contracts";

/**
 * Runtime validation for `VoiceProfile` (see contracts.ts) — needed anywhere
 * a profile crosses a trust boundary: API request body, `organizations.
 * settings` jsonb read back from the database. Discriminated on `mode` so
 * `cloneProfileId` is required exactly when `mode === "cloned"`, matching
 * the type-level union in contracts.ts instead of drifting from it.
 */
const VoiceProfileBaseSchema = z.object({
  locale: z.string().min(2).max(32),
  gender: z.enum(["male", "female", "neutral"]),
  voiceId: z.string().min(1).max(128),
  provider: z.enum(VOICE_PROFILE_PROVIDERS),
  tone: z.string().min(1).max(64).optional(),
  style: z.string().min(1).max(64).optional(),
  speed: z.number().min(0.5).max(2).optional(),
  pitch: z.number().min(-12).max(12).optional(),
});

export const VoiceProfileSchema = z.discriminatedUnion("mode", [
  VoiceProfileBaseSchema.extend({ mode: z.literal("preset") }),
  VoiceProfileBaseSchema.extend({ mode: z.literal("customized") }),
  VoiceProfileBaseSchema.extend({ mode: z.literal("cloned"), cloneProfileId: z.string().min(1).max(128) }),
]);

export function parseVoiceProfile(input: unknown): VoiceProfile {
  return VoiceProfileSchema.parse(input);
}
