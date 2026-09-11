export type ModelStatus = "EXPERIMENTAL" | "CERTIFIED" | "DISABLED" | "DEGRADED";
export type PrivacyClass = "public" | "internal" | "customer_pii" | "regulated";

export interface ModelDefinition {
  readonly provider: string;
  readonly model: string;
  readonly status: ModelStatus;
  readonly capabilities: readonly string[];
  readonly contextWindow: number;
  readonly privacyClass: PrivacyClass;
  readonly qualityScore: number;
  readonly latencyMs: number;
}

export interface ModelRequirements {
  readonly requiredCapabilities: readonly string[];
  readonly privacyClass: PrivacyClass;
  readonly contextTokens: number;
  readonly reserveOut: number;
}

export type ModelRegistry = ReadonlyMap<string, ModelDefinition>;

const PRIVACY_RANK: Record<PrivacyClass, number> = { public: 0, internal: 1, customer_pii: 2, regulated: 3 };
const keyOf = (model: Pick<ModelDefinition, "provider" | "model">): string => `${model.provider}/${model.model}`;

export function createModelRegistry(models: readonly ModelDefinition[]): ModelRegistry {
  const registry = new Map<string, ModelDefinition>();
  for (const model of models) {
    if (!model.provider.trim() || !model.model.trim() || model.contextWindow <= 0) throw new Error("E_MODEL_CONTRACT_INVALID");
    const key = keyOf(model);
    if (registry.has(key)) throw new Error("E_MODEL_DUPLICATE");
    registry.set(key, { ...model, capabilities: [...new Set(model.capabilities)].sort() });
  }
  return registry;
}

export function routeModel(registry: ModelRegistry, requirements: ModelRequirements): ModelDefinition {
  if (requirements.contextTokens < 0 || requirements.reserveOut < 0) throw new Error("E_MODEL_CONTEXT_INVALID");
  const required = new Set(requirements.requiredCapabilities);
  const candidates = [...registry.values()].filter((model) =>
    (model.status === "CERTIFIED" || model.status === "DEGRADED") &&
    PRIVACY_RANK[model.privacyClass] >= PRIVACY_RANK[requirements.privacyClass] &&
    requirements.contextTokens + requirements.reserveOut <= model.contextWindow * 0.9 &&
    [...required].every((capability) => model.capabilities.includes(capability)),
  );
  if (!candidates.length) throw new Error("E_MODEL_NO_COMPATIBLE_CANDIDATE");
  return candidates.sort((left, right) =>
    right.qualityScore - left.qualityScore ||
    left.latencyMs - right.latencyMs ||
    keyOf(left) < keyOf(right) ? -1 : keyOf(left) > keyOf(right) ? 1 : 0,
  )[0]!;
}

export function modelKey(model: Pick<ModelDefinition, "provider" | "model">): string {
  return keyOf(model);
}
