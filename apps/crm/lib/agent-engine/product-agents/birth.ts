import { createHash } from "node:crypto";
import { z } from "zod";

import {
  AGENT_AUTONOMY_LEVELS,
  type AgentDefinition,
} from "../contracts/agent-os";
import { ATENDIMENTO_AGENT_DEFINITION } from "./atendimento";
import { SALES_AGENT_DEFINITION } from "./sales";
import { SUPERVISOR_AGENT_DEFINITION } from "./supervisor";

const loopSchema = z
  .object({
    goal: z.string().min(1),
    maxSteps: z.number().int().positive(),
    maxToolCalls: z.number().int().nonnegative(),
    maxTokens: z.number().int().positive(),
    maxCostCents: z.number().int().nonnegative(),
    maxRuntimeMs: z.number().int().positive(),
    repeatedToolLimit: z.number().int().positive(),
    noProgressLimit: z.number().int().positive(),
  })
  .strict();

export const agentDefinitionSchema = z
  .object({
    id: z.string().min(1).max(100),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    objective: z.string().min(1),
    autonomyLevel: z.enum(AGENT_AUTONOMY_LEVELS),
    allowedSkills: z.array(z.string().min(1)),
    allowedTools: z.array(z.string().min(1)),
    loop: loopSchema,
    requiredModelCapabilities: z.array(z.string().min(1)),
  })
  .strict();

export const agentBirthInputSchema = z
  .object({
    definition: agentDefinitionSchema,
    provenance: z
      .object({
        source: z.string().min(1).max(200),
        sourceRef: z.string().min(1).max(500),
      })
      .strict(),
  })
  .strict();

export interface AgentBirthInput {
  definition: AgentDefinition;
  provenance: { source: string; sourceRef: string };
}

export interface StoredAgentDefinitionVersion {
  definition: AgentDefinition;
  contentHash: string;
  provenance: AgentBirthInput["provenance"];
  createdAt: string;
}

export interface AgentDefinitionVersionStore {
  save(version: StoredAgentDefinitionVersion): Promise<StoredAgentDefinitionVersion>;
  get(id: string, version: string): Promise<StoredAgentDefinitionVersion | null>;
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableNormalize(entry)]),
    );
  }
  return value;
}

function hashBirth(input: AgentBirthInput): string {
  return createHash("sha256")
    .update(JSON.stringify(stableNormalize(input)))
    .digest("hex");
}

export class AgentBirthError extends Error {
  constructor(
    public readonly code:
      | "invalid_definition"
      | "identity_contains_provider"
      | "version_conflict",
    message: string,
  ) {
    super(message);
    this.name = "AgentBirthError";
  }
}

export class InMemoryAgentDefinitionVersionStore
  implements AgentDefinitionVersionStore
{
  private readonly versions = new Map<string, StoredAgentDefinitionVersion>();

  async save(version: StoredAgentDefinitionVersion): Promise<StoredAgentDefinitionVersion> {
    const key = version.definition.id + "@" + version.definition.version;
    const existing = this.versions.get(key);
    if (existing && existing.contentHash !== version.contentHash) {
      throw new AgentBirthError("version_conflict", "agent_definition_version_conflict");
    }
    if (existing) return existing;
    this.versions.set(key, version);
    return version;
  }

  async get(id: string, version: string): Promise<StoredAgentDefinitionVersion | null> {
    return this.versions.get(id + "@" + version) ?? null;
  }
}

export class AgentFactory {
  constructor(
    private readonly store: AgentDefinitionVersionStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async birth(input: unknown): Promise<StoredAgentDefinitionVersion> {
    const parsed = agentBirthInputSchema.safeParse(input);
    if (!parsed.success) {
      const hasIdentityProvider =
        typeof input === "object" &&
        input !== null &&
        ("model" in input || "provider" in input);
      throw new AgentBirthError(
        hasIdentityProvider ? "identity_contains_provider" : "invalid_definition",
        hasIdentityProvider
          ? "agent_identity_must_not_contain_model_or_provider"
          : "invalid_agent_definition",
      );
    }

    const version: StoredAgentDefinitionVersion = {
      definition: parsed.data.definition,
      contentHash: hashBirth(parsed.data),
      provenance: parsed.data.provenance,
      createdAt: this.now(),
    };
    return this.store.save(version);
  }
}

export const FIRST_BIRTH_CONTRACTS: readonly AgentBirthInput[] = [
  {
    definition: { ...SALES_AGENT_DEFINITION, id: "sales" },
    provenance: { source: "product-agent", sourceRef: "product-agents/sales.ts" },
  },
  {
    definition: { ...ATENDIMENTO_AGENT_DEFINITION, id: "support" },
    provenance: { source: "product-agent", sourceRef: "product-agents/atendimento.ts" },
  },
  {
    definition: { ...SUPERVISOR_AGENT_DEFINITION, id: "claude_orchestrator" },
    provenance: { source: "product-agent", sourceRef: "product-agents/supervisor.ts" },
  },
];

export async function birthFirstPartyAgents(
  factory: AgentFactory,
): Promise<readonly StoredAgentDefinitionVersion[]> {
  return Promise.all(FIRST_BIRTH_CONTRACTS.map((input) => factory.birth(input)));
}
