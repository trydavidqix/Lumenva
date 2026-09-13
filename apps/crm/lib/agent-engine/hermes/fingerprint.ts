import { createHash } from 'node:crypto';

export interface HermesContextFingerprintInput {
  domain: string;
  runtime?: string | null;
  packageManager?: string | null;
  dependencies?: string[];
  agentDefinition?: string | null;
  agentVersion?: string | null;
  capabilities?: string[];
  workflowFamily?: string | null;
  modelPolicyClass?: string | null;
  tags?: string[];
}

function normalizedStrings(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
}

export function canonicalHermesContext(input: HermesContextFingerprintInput): Record<string, unknown> {
  if (!input.domain.trim()) throw new Error('hermes_fingerprint_domain_required');
  return {
    domain: input.domain.trim().toLowerCase(),
    runtime: input.runtime?.trim() || null,
    packageManager: input.packageManager?.trim() || null,
    dependencies: normalizedStrings(input.dependencies),
    agentDefinition: input.agentDefinition?.trim() || null,
    agentVersion: input.agentVersion?.trim() || null,
    capabilities: normalizedStrings(input.capabilities),
    workflowFamily: input.workflowFamily?.trim() || null,
    modelPolicyClass: input.modelPolicyClass?.trim() || null,
    tags: normalizedStrings(input.tags),
  };
}

export function buildHermesContextFingerprint(input: HermesContextFingerprintInput): string {
  return createHash('sha256').update(JSON.stringify(canonicalHermesContext(input)), 'utf8').digest('hex');
}
