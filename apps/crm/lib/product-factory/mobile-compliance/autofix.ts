import { createHash } from "node:crypto";
import type { ComplianceFinding, MobileProjectSnapshot } from "./contracts";

export interface SafeTextPatch {
  resource: string;
  expectedOriginalHash: string;
  replacement: string;
  findingFingerprint: string;
}

export interface AutofixResult {
  snapshot: MobileProjectSnapshot;
  applied: SafeTextPatch[];
  rejected: Array<{ patch: SafeTextPatch; reason: string }>;
}

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export function applySafeAutofixes(snapshot: MobileProjectSnapshot, findings: readonly ComplianceFinding[], patches: readonly SafeTextPatch[]): AutofixResult {
  const findingByFingerprint = new Map(findings.map((finding) => [finding.fingerprint, finding]));
  const files = { ...snapshot.files };
  const applied: SafeTextPatch[] = [];
  const rejected: AutofixResult["rejected"] = [];
  for (const patch of patches) {
    const finding = findingByFingerprint.get(patch.findingFingerprint);
    if (!finding) { rejected.push({ patch, reason: "finding_not_found" }); continue; }
    if (!finding.autofixable) { rejected.push({ patch, reason: "finding_not_autofixable" }); continue; }
    const current = files[patch.resource];
    if (current === undefined) { rejected.push({ patch, reason: "resource_not_found" }); continue; }
    if (hash(current) !== patch.expectedOriginalHash) { rejected.push({ patch, reason: "resource_changed_since_audit" }); continue; }
    files[patch.resource] = patch.replacement;
    applied.push(patch);
  }
  return { snapshot: { ...snapshot, files }, applied, rejected };
}
