export {
  INSTRUCTION_LAYERS,
  compareInstructionModules,
  compareText,
  hierarchyContract,
  layerRank,
  orderInstructionModules,
  type InstructionLayer,
  type InstructionModule,
} from "./instruction-hierarchy.js";
export {
  createPromptModule,
  sha256Hex,
  type ExternalContent,
  type PromptModule,
  type PromptModuleInput,
  type PromptProvenance as ModuleProvenanceSource,
} from "./prompt-modules.js";
export {
  assertPromptVersion,
  canonicalJson,
  versionFingerprint,
  type ExternalProvenance,
  type ModuleProvenance,
  type PromptProvenance,
  type PromptVersion,
} from "./versioning.js";
export {
  SystemPromptCompiler,
  type CompilePromptInput,
  type CompiledSystemPrompt,
} from "./compiler.js";

export {
  certifyBirth,
  type BirthArtifact,
  type CertificationCheck,
  type CertificationDecision,
  type CertificationInput,
  type CertificationPolicy,
  type CertificationResult,
  type CompletionPolicyInput,
  type VerificationPolicyInput,
  type VersionedCapability,
} from "./certification.js";
