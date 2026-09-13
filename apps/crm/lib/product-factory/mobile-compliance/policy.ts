import { createHash } from "node:crypto";
import type { ComplianceRule, MobileStore, PolicySnapshot } from "./contracts";

export const APPLE_RULES: readonly ComplianceRule[] = Object.freeze([
  { id: "APPLE.PRIVACY.MANIFEST", platform: "IOS", store: "APP_STORE", severity: "MEDIUM", category: "privacy", description: "Privacy manifest should be present when the app uses APIs covered by Apple's privacy manifest regime.", deterministic: true },
  { id: "APPLE.ATT.USAGE", platform: "IOS", store: "APP_STORE", severity: "HIGH", category: "privacy", description: "Apps using tracking or advertising identifiers must declare the tracking usage description and follow ATT requirements.", deterministic: true },
  { id: "APPLE.ACCOUNT.DELETE", platform: "IOS", store: "APP_STORE", severity: "HIGH", category: "accounts", description: "Apps that support account creation must expose an in-app account deletion path.", deterministic: true },
  { id: "APPLE.IAP.RESTORE", platform: "IOS", store: "APP_STORE", severity: "HIGH", category: "purchases", description: "Apps with restorable purchases or subscriptions must expose restoration behavior where applicable.", deterministic: true },
  { id: "APPLE.METADATA.PRIVACY", platform: "IOS", store: "APP_STORE", severity: "HIGH", category: "metadata", description: "A privacy policy URL and App Privacy declaration are required when applicable.", deterministic: true },
  { id: "APPLE.REVIEW.DEMO", platform: "IOS", store: "APP_STORE", severity: "HIGH", category: "review", description: "Apps requiring authentication must provide reviewer access instructions or demo credentials.", deterministic: true },
]);

export const GOOGLE_RULES: readonly ComplianceRule[] = Object.freeze([
  { id: "GOOGLE.MANIFEST.PRESENT", platform: "ANDROID", store: "PLAY_STORE", severity: "CRITICAL", category: "package", description: "Android release artifacts require an AndroidManifest.xml.", deterministic: true },
  { id: "GOOGLE.EXPORTED.COMPONENTS", platform: "ANDROID", store: "PLAY_STORE", severity: "HIGH", category: "security", description: "Components with intent filters on modern Android must declare exported behavior explicitly.", deterministic: true },
  { id: "GOOGLE.ACCOUNT.DELETE", platform: "ANDROID", store: "PLAY_STORE", severity: "HIGH", category: "accounts", description: "Apps that support account creation need an account deletion flow and external deletion URL.", deterministic: true },
  { id: "GOOGLE.DATA_SAFETY", platform: "ANDROID", store: "PLAY_STORE", severity: "MEDIUM", category: "privacy", description: "The Play Data safety declaration must be maintained and consistent with app behavior.", deterministic: true },
  { id: "GOOGLE.BILLING.POLICY", platform: "ANDROID", store: "PLAY_STORE", severity: "HIGH", category: "purchases", description: "Apps selling eligible digital goods or subscriptions must use a compliant Play billing implementation.", deterministic: true },
  { id: "GOOGLE.PERMISSION.SENSITIVE", platform: "ANDROID", store: "PLAY_STORE", severity: "HIGH", category: "permissions", description: "Highly sensitive permissions require policy justification and careful review.", deterministic: true },
  { id: "GOOGLE.METADATA.PRIVACY", platform: "ANDROID", store: "PLAY_STORE", severity: "HIGH", category: "metadata", description: "A privacy policy and required store privacy disclosures must be present.", deterministic: true },
]);

const POLICY_META = {
  APP_STORE: {
    provider: "APPLE" as const,
    version: "apple-app-review-2026-06-08",
    retrievedAt: "2026-09-13T00:00:00.000Z",
    sourceRefs: ["https://developer.apple.com/app-store/review/guidelines/"],
    rules: APPLE_RULES,
  },
  PLAY_STORE: {
    provider: "GOOGLE" as const,
    version: "google-play-curated-2026-09-13",
    retrievedAt: "2026-09-13T00:00:00.000Z",
    sourceRefs: ["https://support.google.com/googleplay/android-developer/topic/9877466"],
    rules: GOOGLE_RULES,
  },
} satisfies Record<MobileStore, Omit<PolicySnapshot, "rulesHash">>;

export function createPolicySnapshot(store: MobileStore): PolicySnapshot {
  const meta = POLICY_META[store];
  const normalized = JSON.stringify(meta.rules.map((rule) => ({ ...rule })));
  return Object.freeze({ ...meta, rulesHash: createHash("sha256").update(normalized).digest("hex") });
}
