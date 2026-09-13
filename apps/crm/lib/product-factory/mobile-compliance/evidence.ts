import { createHash } from "node:crypto";
import type { ComplianceEvidence, ComplianceFinding, ComplianceSeverity, FindingSource, FindingVerification, MobilePlatform, MobileStore } from "./contracts";

export function findLine(content: string, needle: string): number | undefined {
  const index = content.indexOf(needle);
  if (index < 0) return undefined;
  return content.slice(0, index).split("\n").length;
}

export function createEvidence(input: { ruleId: string; resource: string; content: string; detector: string; needle?: string }): ComplianceEvidence {
  const excerpt = input.needle && input.content.includes(input.needle) ? input.needle : input.content.slice(0, 240);
  const excerptHash = createHash("sha256").update(excerpt).digest("hex");
  const identity = `${input.ruleId}\u0000${input.resource}\u0000${excerptHash}`;
  return {
    evidenceId: `evidence:${createHash("sha256").update(identity).digest("hex")}`,
    ruleId: input.ruleId,
    resource: input.resource,
    ...(input.needle ? { line: findLine(input.content, input.needle) } : {}),
    excerptHash,
    detector: input.detector,
  };
}

export function findingFingerprint(input: Pick<ComplianceFinding, "ruleId" | "resource" | "line">): string {
  return createHash("sha256").update(`${input.ruleId}\u0000${input.resource}\u0000${input.line ?? 0}`).digest("hex");
}

export function createFinding(input: {
  ruleId: string;
  platform: MobilePlatform;
  store: MobileStore;
  severity: ComplianceSeverity;
  source: FindingSource;
  verification?: FindingVerification;
  title: string;
  description: string;
  resource: string;
  line?: number;
  evidenceRefs?: string[];
  autofixable?: boolean;
}): ComplianceFinding {
  const finding: ComplianceFinding = {
    ...input,
    verification: input.verification ?? "VERIFIED",
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    autofixable: input.autofixable ?? false,
    fingerprint: "",
  };
  finding.fingerprint = findingFingerprint(finding);
  return finding;
}

export function dedupeFindings(findings: readonly ComplianceFinding[]): ComplianceFinding[] {
  const byFingerprint = new Map<string, ComplianceFinding>();
  for (const finding of findings) {
    const existing = byFingerprint.get(finding.fingerprint);
    if (!existing) {
      byFingerprint.set(finding.fingerprint, { ...finding, evidenceRefs: [...finding.evidenceRefs] });
      continue;
    }
    existing.evidenceRefs = [...new Set([...existing.evidenceRefs, ...finding.evidenceRefs])];
    if (existing.verification === "MANUAL_REVIEW" && finding.verification === "VERIFIED") existing.verification = "VERIFIED";
  }
  return [...byFingerprint.values()];
}
