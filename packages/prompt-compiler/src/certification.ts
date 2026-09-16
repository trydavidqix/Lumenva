import type { CompiledSystemPrompt } from "./compiler.js";
import { canonicalJson, type PromptProvenance } from "./versioning.js";
import { sha256Hex } from "./prompt-modules.js";

export type CertificationDecision = "PASS" | "FAIL";
export type CertificationCheckStatus = "PASS" | "FAIL";

export interface VersionedCapability {
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
}

export interface CertificationPolicy {
  readonly allowedSkillNames: readonly string[];
  readonly allowedToolNames: readonly string[];
  readonly forbiddenCapabilities?: readonly string[];
}

export interface VerificationPolicyInput {
  readonly rules: readonly { readonly envelope: string; readonly verifyVia: string }[];
  readonly envelopes: readonly string[];
}

export interface CompletionPolicyInput {
  readonly conditions: readonly { readonly id: string; readonly verifyVia: string }[];
  readonly verifiedIds: readonly string[];
}

export interface CertificationInput {
  readonly agent: { readonly id: string; readonly version: string };
  readonly compiledPrompt: CompiledSystemPrompt;
  readonly requiredPromptModules: readonly string[];
  readonly skills: readonly VersionedCapability[];
  readonly tools: readonly VersionedCapability[];
  readonly policy: CertificationPolicy;
  readonly verification: VerificationPolicyInput;
  readonly completion: CompletionPolicyInput;
}

export interface CertificationCheck {
  readonly id: string;
  readonly status: CertificationCheckStatus;
  readonly reason: string;
}

export interface BirthArtifact {
  readonly artifactVersion: "1.0.0";
  readonly agent: { readonly id: string; readonly version: string };
  readonly prompt: {
    readonly hash: string;
    readonly version: string;
    readonly compilerVersion: string;
    readonly provenance: PromptProvenance;
  };
  readonly skills: readonly VersionedCapability[];
  readonly tools: readonly VersionedCapability[];
  readonly policy: CertificationPolicy;
  readonly verification: VerificationPolicyInput;
  readonly completion: CompletionPolicyInput;
  readonly decision: CertificationDecision;
  readonly checks: readonly CertificationCheck[];
  readonly artifactHash: string;
}

export interface CertificationResult {
  readonly decision: CertificationDecision;
  readonly checks: readonly CertificationCheck[];
  readonly artifact: BirthArtifact;
}

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(compareStable);
}

function capabilitySnapshot(values: readonly VersionedCapability[]): VersionedCapability[] {
  return [...values]
    .map((value) => ({
      name: value.name.trim(),
      version: value.version.trim(),
      capabilities: sortedUnique(value.capabilities),
    }))
    .sort((left, right) => compareStable(left.name, right.name) || compareStable(left.version, right.version));
}

function normalizeVerification(input: VerificationPolicyInput): VerificationPolicyInput {
  return {
    rules: [...input.rules]
      .map((rule) => ({ envelope: rule.envelope.trim(), verifyVia: rule.verifyVia.trim() }))
      .sort((left, right) => compareStable(left.envelope, right.envelope) || compareStable(left.verifyVia, right.verifyVia)),
    envelopes: sortedUnique(input.envelopes),
  };
}

function normalizeCompletion(input: CompletionPolicyInput): CompletionPolicyInput {
  return {
    conditions: [...input.conditions]
      .map((condition) => ({ id: condition.id.trim(), verifyVia: condition.verifyVia.trim() }))
      .sort((left, right) => compareStable(left.id, right.id) || compareStable(left.verifyVia, right.verifyVia)),
    verifiedIds: sortedUnique(input.verifiedIds),
  };
}

function check(id: string, ok: boolean, reason: string): CertificationCheck {
  return { id, status: ok ? "PASS" : "FAIL", reason };
}

function promptHashMatches(prompt: CompiledSystemPrompt): boolean {
  const { compiledSha256: _compiledSha256, ...provenanceWithoutHash } = prompt.provenance;
  return sha256Hex(canonicalJson({ version: prompt.version, prompt: prompt.prompt, provenance: provenanceWithoutHash })) === prompt.hash;
}

function promptProvenanceComplete(provenance: PromptProvenance): boolean {
  return Boolean(
    provenance.promptId.trim() &&
      provenance.promptVersion.trim() &&
      provenance.compilerVersion.trim() &&
      provenance.compiledSha256.trim() &&
      provenance.modules.every((module) =>
        Boolean(module.id.trim() && module.version.trim() && module.layer.trim() && module.source.trim() && module.locator.trim() && /^[a-f0-9]{64}$/.test(module.contentSha256)),
      ) &&
      provenance.external.every((item) =>
        Boolean(item.source.trim() && item.version.trim() && /^[a-f0-9]{64}$/.test(item.contentSha256)),
      ),
  );
}

function evaluateVerification(input: VerificationPolicyInput): boolean {
  return input.envelopes.every((envelope) =>
    input.rules.some((rule) => rule.envelope === envelope && rule.verifyVia.trim() !== ""),
  );
}

function evaluateCompletion(input: CompletionPolicyInput): boolean {
  const verified = new Set(input.verifiedIds);
  return input.conditions.every((condition) => verified.has(condition.id) && condition.verifyVia.trim() !== "");
}

function duplicateNames(values: readonly VersionedCapability[]): boolean {
  return new Set(values.map((value) => value.name)).size !== values.length;
}

export function certifyBirth(input: CertificationInput): CertificationResult {
  const skills = capabilitySnapshot(input.skills);
  const tools = capabilitySnapshot(input.tools);
  const allowedSkills = new Set(sortedUnique(input.policy.allowedSkillNames));
  const allowedTools = new Set(sortedUnique(input.policy.allowedToolNames));
  const forbidden = new Set(sortedUnique(input.policy.forbiddenCapabilities ?? []));
  const prompt = input.compiledPrompt;
  const verification = normalizeVerification(input.verification);
  const completion = normalizeCompletion(input.completion);
  const moduleIds = new Set(prompt.provenance.modules.map((module) => module.id));
  const promptChecks: CertificationCheck[] = [
    check("contract", Boolean(input.agent.id.trim() && input.agent.version.trim()), "agent identity is required"),
    check("prompt_hash", /^[a-f0-9]{64}$/.test(prompt.hash) && prompt.provenance.compiledSha256 === prompt.hash && promptHashMatches(prompt), "compiled prompt hash must match provenance and inputs"),
    check("prompt_provenance", promptProvenanceComplete(prompt.provenance), "prompt provenance must be complete"),
    check("required_modules", input.requiredPromptModules.every((id) => moduleIds.has(id)), "required prompt modules must be present"),
    check("skills_permitted", !duplicateNames(skills) && skills.every((skill) => allowedSkills.has(skill.name)), "skills must be unique and allowed by policy"),
    check("tools_permitted", !duplicateNames(tools) && tools.every((tool) => allowedTools.has(tool.name)), "tools must be unique and allowed by policy"),
    check("forbidden_capabilities", ![...skills, ...tools].some((item) => item.capabilities.some((capability) => forbidden.has(capability))), "forbidden capabilities must be absent"),
    check("verification_policy", evaluateVerification(verification), "verification policy must cover every requested envelope"),
    check("completion_policy", evaluateCompletion(completion), "completion policy conditions must be verified"),
  ];
  const decision: CertificationDecision = promptChecks.every((item) => item.status === "PASS") ? "PASS" : "FAIL";
  const artifactWithoutHash = {
    artifactVersion: "1.0.0" as const,
    agent: { id: input.agent.id.trim(), version: input.agent.version.trim() },
    prompt: {
      hash: prompt.hash,
      version: prompt.version.version,
      compilerVersion: prompt.version.compilerVersion,
      provenance: prompt.provenance,
    },
    skills,
    tools,
    policy: {
      allowedSkillNames: sortedUnique(input.policy.allowedSkillNames),
      allowedToolNames: sortedUnique(input.policy.allowedToolNames),
      ...(input.policy.forbiddenCapabilities ? { forbiddenCapabilities: sortedUnique(input.policy.forbiddenCapabilities) } : {}),
    },
    verification,
    completion,
    decision,
    checks: promptChecks,
  };
  const artifact: BirthArtifact = {
    ...artifactWithoutHash,
    artifactHash: sha256Hex(canonicalJson(artifactWithoutHash)),
  };
  return { decision, checks: promptChecks, artifact };
}
