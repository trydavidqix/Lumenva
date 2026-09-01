export type ModelCapability =
  | 'tool_calling'
  | 'structured_output'
  | 'vision'
  | 'reasoning'
  | 'parallel_tools'
  | 'long_context'
  | 'streaming';

export type ModelCertificationState = 'EXPERIMENTAL' | 'CERTIFIED' | 'DISABLED';

export interface CertifiedModelMetadata {
  provider: string;
  model: string;
  certification: ModelCertificationState;
  capabilities: ModelCapability[];
  qualityScore: number;
  costScore: number;
}

export function filterCertifiedModels(
  models: readonly CertifiedModelMetadata[],
  input: { requiredCapabilities: readonly ModelCapability[] },
): CertifiedModelMetadata[] {
  const filtered = models.filter((model) => {
    if (model.certification !== 'CERTIFIED') return false;
    return input.requiredCapabilities.every((capability) =>
      model.capabilities.includes(capability),
    );
  });

  return [...filtered].sort((a, b) => {
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    return b.costScore - a.costScore;
  });
}
