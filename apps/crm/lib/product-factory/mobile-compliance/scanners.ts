import type { ComplianceEvidence, ComplianceFinding, MobilePlatform, MobileProjectSnapshot, MobileStore } from "./contracts";
import { createEvidence, createFinding } from "./evidence";

export interface ScanResult { findings: ComplianceFinding[]; evidence: ComplianceEvidence[] }

function fileEntries(snapshot: MobileProjectSnapshot): Array<[string, string]> { return Object.entries(snapshot.files); }
function findFile(snapshot: MobileProjectSnapshot, matcher: (path: string) => boolean): [string, string] | undefined { return fileEntries(snapshot).find(([path]) => matcher(path)); }
function combinedText(snapshot: MobileProjectSnapshot): string { return fileEntries(snapshot).map(([path, content]) => `${path}\n${content}`).join("\n"); }
function containsAny(text: string, needles: readonly string[]): boolean { const lower = text.toLowerCase(); return needles.some((needle) => lower.includes(needle.toLowerCase())); }

function verifiedFinding(input: Omit<Parameters<typeof createFinding>[0], "evidenceRefs">, evidence: ComplianceEvidence): ComplianceFinding {
  return createFinding({ ...input, evidenceRefs: [evidence.evidenceId] });
}

export function scanApple(snapshot: MobileProjectSnapshot): ScanResult {
  const findings: ComplianceFinding[] = []; const evidence: ComplianceEvidence[] = [];
  const platform: MobilePlatform = "IOS"; const store: MobileStore = "APP_STORE";
  const all = combinedText(snapshot);
  const manifest = findFile(snapshot, (path) => path.endsWith("PrivacyInfo.xcprivacy"));
  if (!manifest) {
    const ev = createEvidence({ ruleId: "APPLE.PRIVACY.MANIFEST", resource: "project", content: Object.keys(snapshot.files).join("\n"), detector: "apple-static" }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId: "APPLE.PRIVACY.MANIFEST", platform, store, severity: "MEDIUM", source: "STATIC", title: "Privacy manifest not found", description: "No PrivacyInfo.xcprivacy was found. Confirm whether the app or included SDKs use APIs requiring privacy manifest declarations.", resource: "project", verification: "MANUAL_REVIEW" }, ev));
  }
  const trackingUsed = containsAny(all, ["ASIdentifierManager", "AdSupport", "advertisingIdentifier", "ATTrackingManager"]);
  const plist = findFile(snapshot, (path) => path.endsWith("Info.plist"));
  if (trackingUsed && (!plist || !plist[1].includes("NSUserTrackingUsageDescription"))) {
    const target = plist ?? ["project", all]; const ev = createEvidence({ ruleId: "APPLE.ATT.USAGE", resource: target[0], content: target[1], detector: "apple-static", needle: trackingUsed && target[1].includes("AdSupport") ? "AdSupport" : undefined }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId: "APPLE.ATT.USAGE", platform, store, severity: "HIGH", source: "STATIC", title: "Tracking usage declaration is missing", description: "Tracking-related APIs were detected without NSUserTrackingUsageDescription in Info.plist.", resource: target[0], line: ev.line }, ev));
  }
  if (snapshot.storeMetadata?.accountCreation === true && !containsAny(all, ["delete account", "deleteaccount", "apagar conta", "excluir conta", "remove account", "account deletion"])) {
    const ev = createEvidence({ ruleId: "APPLE.ACCOUNT.DELETE", resource: "project", content: all, detector: "apple-static" }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId: "APPLE.ACCOUNT.DELETE", platform, store, severity: "HIGH", source: "STATIC", title: "In-app account deletion path not detected", description: "Account creation is declared, but no account deletion path was found in the supplied project snapshot.", resource: "project" }, ev));
  }
  if (snapshot.storeMetadata?.usesSubscriptions === true && !containsAny(all, ["restore purchases", "restorepurchase", "restorecompletedtransactions", "restore purchases"])) {
    const ev = createEvidence({ ruleId: "APPLE.IAP.RESTORE", resource: "project", content: all, detector: "apple-static" }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId: "APPLE.IAP.RESTORE", platform, store, severity: "HIGH", source: "STATIC", title: "Purchase restoration path not detected", description: "Subscriptions are declared, but a purchase restoration path was not found.", resource: "project" }, ev));
  }
  return { findings, evidence };
}

export function scanGoogle(snapshot: MobileProjectSnapshot): ScanResult {
  const findings: ComplianceFinding[] = []; const evidence: ComplianceEvidence[] = [];
  const platform: MobilePlatform = "ANDROID"; const store: MobileStore = "PLAY_STORE";
  const all = combinedText(snapshot);
  const manifest = findFile(snapshot, (path) => path.endsWith("AndroidManifest.xml"));
  if (!manifest) {
    const ev = createEvidence({ ruleId: "GOOGLE.MANIFEST.PRESENT", resource: "project", content: Object.keys(snapshot.files).join("\n"), detector: "google-static" }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId: "GOOGLE.MANIFEST.PRESENT", platform, store, severity: "CRITICAL", source: "STATIC", title: "AndroidManifest.xml not found", description: "No AndroidManifest.xml was supplied for the Android target.", resource: "project" }, ev));
  } else {
    const manifestText = manifest[1];
    const componentWithIntentFilter = /<(activity|service|receiver)\b(?:(?!android:exported)[\s\S])*?<intent-filter\b/i.test(manifestText);
    if (componentWithIntentFilter) {
      const ev = createEvidence({ ruleId: "GOOGLE.EXPORTED.COMPONENTS", resource: manifest[0], content: manifestText, detector: "google-static", needle: "<intent-filter" }); evidence.push(ev);
      findings.push(verifiedFinding({ ruleId: "GOOGLE.EXPORTED.COMPONENTS", platform, store, severity: "HIGH", source: "STATIC", title: "Intent-filter component may be missing android:exported", description: "A component with an intent filter was detected without an explicit android:exported attribute in the scanned component block.", resource: manifest[0], line: ev.line }, ev));
    }
    for (const permission of ["QUERY_ALL_PACKAGES", "MANAGE_EXTERNAL_STORAGE"] as const) {
      if (manifestText.includes(permission)) {
        const ev = createEvidence({ ruleId: "GOOGLE.PERMISSION.SENSITIVE", resource: manifest[0], content: manifestText, detector: "google-static", needle: permission }); evidence.push(ev);
        findings.push(verifiedFinding({ ruleId: "GOOGLE.PERMISSION.SENSITIVE", platform, store, severity: "HIGH", source: "STATIC", verification: "MANUAL_REVIEW", title: `Sensitive permission ${permission} requires policy review`, description: "A highly sensitive Android permission was detected and should be checked against Play policy eligibility and declarations.", resource: manifest[0], line: ev.line }, ev));
      }
    }
  }
  if (snapshot.storeMetadata?.accountCreation === true && !snapshot.storeMetadata.accountDeletionUrl) {
    const ev = createEvidence({ ruleId: "GOOGLE.ACCOUNT.DELETE", resource: "store-metadata", content: JSON.stringify(snapshot.storeMetadata), detector: "google-metadata" }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId: "GOOGLE.ACCOUNT.DELETE", platform, store, severity: "HIGH", source: "METADATA", title: "External account deletion URL is missing", description: "Account creation is declared but accountDeletionUrl is not present in the store metadata snapshot.", resource: "store-metadata" }, ev));
  }
  if (snapshot.storeMetadata?.usesSubscriptions === true && !containsAny(all, ["billingclient", "com.android.billingclient", "purchasesupdatedlistener"])) {
    const ev = createEvidence({ ruleId: "GOOGLE.BILLING.POLICY", resource: "project", content: all, detector: "google-static" }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId: "GOOGLE.BILLING.POLICY", platform, store, severity: "HIGH", source: "STATIC", title: "Play Billing implementation not detected", description: "Subscriptions are declared but no Play Billing implementation marker was found.", resource: "project" }, ev));
  }
  return { findings, evidence };
}

export function auditStoreMetadata(platform: MobilePlatform, snapshot: MobileProjectSnapshot): ScanResult {
  const store: MobileStore = platform === "IOS" ? "APP_STORE" : "PLAY_STORE";
  const findings: ComplianceFinding[] = []; const evidence: ComplianceEvidence[] = [];
  const metadata = snapshot.storeMetadata ?? {};
  const ruleId = platform === "IOS" ? "APPLE.METADATA.PRIVACY" : "GOOGLE.METADATA.PRIVACY";
  if (!metadata.privacyPolicyUrl) {
    const ev = createEvidence({ ruleId, resource: "store-metadata", content: JSON.stringify(metadata), detector: "store-metadata" }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId, platform, store, severity: "HIGH", source: "METADATA", title: "Privacy policy URL is missing", description: "The store metadata snapshot does not include a privacyPolicyUrl.", resource: "store-metadata" }, ev));
  }
  if (platform === "IOS" && metadata.requiresAuthentication === true && metadata.demoAccountProvided !== true && !metadata.reviewNotes) {
    const ev = createEvidence({ ruleId: "APPLE.REVIEW.DEMO", resource: "store-metadata", content: JSON.stringify(metadata), detector: "store-metadata" }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId: "APPLE.REVIEW.DEMO", platform, store, severity: "HIGH", source: "METADATA", title: "Reviewer access instructions are missing", description: "Authentication is required but no demo account or review notes were supplied.", resource: "store-metadata" }, ev));
  }
  if (platform === "ANDROID" && metadata.dataSafetyDeclared !== true) {
    const ev = createEvidence({ ruleId: "GOOGLE.DATA_SAFETY", resource: "store-metadata", content: JSON.stringify(metadata), detector: "store-metadata" }); evidence.push(ev);
    findings.push(verifiedFinding({ ruleId: "GOOGLE.DATA_SAFETY", platform, store, severity: "MEDIUM", source: "METADATA", verification: "MANUAL_REVIEW", title: "Data safety declaration is not confirmed", description: "The supplied metadata does not confirm that the Play Data safety declaration has been completed.", resource: "store-metadata" }, ev));
  }
  return { findings, evidence };
}
