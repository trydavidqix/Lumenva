import type { ScenarioActorTemplate, ScenarioPopulation, SyntheticActor } from "../contracts/scenario";

export interface BuildPopulationInput {
  organizationId: string;
  scenarioId: string;
  populationId: string;
  version: number;
  seed: number;
  size: number;
  generatorVersion: string;
  templates: ScenarioActorTemplate[];
  enforceMvpBounds?: boolean;
  now?: string;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function forbiddenIdentityKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return (
    normalized === "email" ||
    normalized === "phone" ||
    normalized === "phonenumber" ||
    normalized === "contactid" ||
    normalized === "crmcontactid" ||
    normalized === "leadid" ||
    normalized === "companyid" ||
    normalized === "userid" ||
    normalized === "dealid" ||
    normalized === "personid"
  );
}

function sanitizeAggregateValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAggregateValue);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenIdentityKey(key)) continue;
    output[key] = sanitizeAggregateValue(nested);
  }
  return output;
}

function chooseTemplate(templates: ScenarioActorTemplate[], random: () => number): ScenarioActorTemplate {
  const positive = templates.map((template) => Math.max(0, template.weight));
  const total = positive.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return templates[Math.floor(random() * templates.length)]!;
  let cursor = random() * total;
  for (let index = 0; index < templates.length; index += 1) {
    cursor -= positive[index] ?? 0;
    if (cursor <= 0) return templates[index]!;
  }
  return templates[templates.length - 1]!;
}

function deriveTraits(template: ScenarioActorTemplate, random: () => number): Record<string, unknown> {
  const sanitized = sanitizeAggregateValue(template.traits) as Record<string, unknown>;
  const derived: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const jitter = (random() - 0.5) * 0.1;
      derived[key] = Number((value + jitter).toFixed(6));
    } else {
      derived[key] = value;
    }
  }
  return derived;
}

export function buildSyntheticPopulation(input: BuildPopulationInput): ScenarioPopulation {
  const enforceBounds = input.enforceMvpBounds ?? true;
  if (enforceBounds && (input.size < 24 || input.size > 50)) {
    throw new Error("Scenario Lab MVP populations must contain between 24 and 50 synthetic actors.");
  }
  if (input.size < 1 || input.size > 10_000) throw new Error("Synthetic population size is outside the safety limit.");
  if (!Number.isSafeInteger(input.seed)) throw new Error("Population seed must be a safe integer.");
  if (input.templates.length === 0) throw new Error("Synthetic population requires at least one actor template.");

  for (const template of input.templates) {
    if (template.organizationId !== input.organizationId || template.scenarioId !== input.scenarioId) {
      throw new Error("Actor template is outside the scenario tenant boundary.");
    }
  }

  const random = mulberry32(input.seed);
  const createdAt = input.now ?? new Date().toISOString();
  const actors: SyntheticActor[] = [];
  for (let index = 0; index < input.size; index += 1) {
    const template = chooseTemplate(input.templates, random);
    actors.push({
      id: `synthetic:${input.populationId}:${index + 1}`,
      synthetic: true,
      scenarioId: input.scenarioId,
      populationId: input.populationId,
      actorTemplateId: template.id,
      seed: input.seed,
      generatorVersion: input.generatorVersion,
      traits: deriveTraits(template, random),
      evidenceRefs: [...template.evidenceRefs],
      createdAt,
    });
  }

  return {
    id: input.populationId,
    organizationId: input.organizationId,
    scenarioId: input.scenarioId,
    version: input.version,
    seed: input.seed,
    size: actors.length,
    generatorVersion: input.generatorVersion,
    actors,
    config: {
      templateKeys: input.templates.map((template) => template.key),
      synthetic: true,
    },
  };
}
