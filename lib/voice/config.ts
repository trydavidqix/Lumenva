import { z } from "zod";

export const VOICE_ROUTING_MODES = ["always_ai", "no_answer", "after_hours", "overflow"] as const;
export type VoiceRoutingMode = (typeof VOICE_ROUTING_MODES)[number];

const BusinessHoursDaySchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const VoiceTenantConfigSchema = z.object({
  mode: z.enum(VOICE_ROUTING_MODES),
  locale: z.string().min(2).max(32),
  timezone: z.string().min(1).max(128),
  maxCallDurationSeconds: z.number().int().min(60).max(14_400),
  silenceTimeoutSeconds: z.number().int().min(3).max(300),
  humanTransferDestinations: z.array(z.string().min(1).max(128)).max(20),
  businessHours: z.object({
    monday: BusinessHoursDaySchema,
    tuesday: BusinessHoursDaySchema,
    wednesday: BusinessHoursDaySchema,
    thursday: BusinessHoursDaySchema,
    friday: BusinessHoursDaySchema,
    saturday: BusinessHoursDaySchema,
    sunday: BusinessHoursDaySchema,
  }),
  recording: z.object({
    enabled: z.boolean(),
    requireConsentDisclosure: z.boolean(),
  }),
  transcription: z.object({
    enabled: z.boolean(),
    retainDays: z.number().int().min(0).max(3650),
  }),
});

export type VoiceTenantConfig = z.infer<typeof VoiceTenantConfigSchema>;

const weekday = { enabled: true, start: "09:00", end: "18:00" } as const;
const weekend = { enabled: false, start: "09:00", end: "18:00" } as const;

export const DEFAULT_VOICE_TENANT_CONFIG: VoiceTenantConfig = {
  mode: "no_answer",
  locale: "pt-PT",
  timezone: "Europe/Lisbon",
  maxCallDurationSeconds: 1800,
  silenceTimeoutSeconds: 20,
  humanTransferDestinations: [],
  businessHours: {
    monday: { ...weekday },
    tuesday: { ...weekday },
    wednesday: { ...weekday },
    thursday: { ...weekday },
    friday: { ...weekday },
    saturday: { ...weekend },
    sunday: { ...weekend },
  },
  recording: { enabled: false, requireConsentDisclosure: true },
  transcription: { enabled: false, retainDays: 0 },
};

export function parseVoiceTenantConfig(input: unknown): VoiceTenantConfig {
  return VoiceTenantConfigSchema.parse(input);
}

export function parseStoredVoiceTenantConfig(input: unknown): VoiceTenantConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) return structuredClone(DEFAULT_VOICE_TENANT_CONFIG);
  const candidate = input as Partial<VoiceTenantConfig>;
  return VoiceTenantConfigSchema.parse({
    ...DEFAULT_VOICE_TENANT_CONFIG,
    ...candidate,
    businessHours: { ...DEFAULT_VOICE_TENANT_CONFIG.businessHours, ...(candidate.businessHours ?? {}) },
    recording: { ...DEFAULT_VOICE_TENANT_CONFIG.recording, ...(candidate.recording ?? {}) },
    transcription: { ...DEFAULT_VOICE_TENANT_CONFIG.transcription, ...(candidate.transcription ?? {}) },
  });
}

export function mergeVoiceTenantConfig(
  current: VoiceTenantConfig,
  patch: Partial<VoiceTenantConfig>,
): VoiceTenantConfig {
  return VoiceTenantConfigSchema.parse({
    ...current,
    ...patch,
    businessHours: { ...current.businessHours, ...(patch.businessHours ?? {}) },
    recording: { ...current.recording, ...(patch.recording ?? {}) },
    transcription: { ...current.transcription, ...(patch.transcription ?? {}) },
  });
}
