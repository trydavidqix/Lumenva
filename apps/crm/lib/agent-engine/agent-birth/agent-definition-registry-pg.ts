import { certifyAgentDefinition, type AgentDefinition, type AgentDefinitionApproval, type AgentDefinitionOrigin } from "./agent-definition";
import type { AgentBirthAuthorityStore, AuthorityQueryable } from "./agent-birth-authority-store";

export type DurableRegistryInput = { definition: unknown; origin: AgentDefinitionOrigin; expectedTenantId: string; approval?: AgentDefinitionApproval; authorityStore: AgentBirthAuthorityStore };

type RegistryRow = {
  definition_id: string;
  definition_version: string;
  identity: string;
  mission: string;
  boundaries: unknown;
  authority: string;
  escalation: string;
  status: AgentDefinition["status"];
};

function definitionField(definition: unknown, field: "id" | "version"): string {
  if (typeof definition !== "object" || definition === null || !(field in definition)) return "";
  const value = (definition as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function boundariesFromRow(value: unknown): string[] {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || !parsed.every((boundary): boundary is string => typeof boundary === "string")) {
    throw new Error("agent_definition_boundaries_invalid");
  }
  return [...parsed];
}

export class PostgresAgentDefinitionRegistry {
  constructor(private readonly db: AuthorityQueryable) {}
  async initialize(): Promise<void> {
    await this.db.query(`CREATE TABLE IF NOT EXISTS public.agent_definition_registry (
      organization_id text NOT NULL, definition_id text NOT NULL, definition_version text NOT NULL,
      identity text NOT NULL, mission text NOT NULL, boundaries jsonb NOT NULL,
      authority text NOT NULL, escalation text NOT NULL, status text NOT NULL,
      origin_actor_id text NOT NULL, approval_id text NOT NULL, approver_id text NOT NULL,
      policy_version text NOT NULL, approved_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, definition_id, definition_version),
      UNIQUE (organization_id, approval_id)
    )`);
  }
  async register(input: DurableRegistryInput): Promise<void> {
    const authority = await input.authorityStore.verify({
      tenantId: input.expectedTenantId,
      definitionId: definitionField(input.definition, "id"),
      definitionVersion: definitionField(input.definition, "version"),
      origin: input.origin, approvalId: input.approval?.approval_id ?? "", approverId: input.approval?.approver_id ?? "",
    });
    const certification = certifyAgentDefinition(input.definition, { origin: authority.origin, expected_tenant_id: input.expectedTenantId, approval: authority.approval });
    if (!certification.ok) throw new Error(`agent_definition_registration_rejected:${certification.errors.join(",")}`);
    const definition = certification.definition; const approval = authority.approval;
    const result = await this.db.query<{ definition_id: string }>(`INSERT INTO public.agent_definition_registry
      (organization_id,definition_id,definition_version,identity,mission,boundaries,authority,escalation,status,origin_actor_id,approval_id,approver_id,policy_version,approved_at)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (organization_id,definition_id,definition_version) DO NOTHING RETURNING definition_id`,
      [input.expectedTenantId, definition.id, definition.version, definition.identity, definition.mission, JSON.stringify(definition.boundaries), definition.authority, definition.escalation, definition.status, authority.origin.actor_id, approval.approval_id, approval.approver_id, approval.policy_version, approval.approved_at]);
    if (result.rows.length !== 1) throw new Error("agent_definition_duplicate");
  }
  async get(tenantId: string, id: string, version: string): Promise<AgentDefinition | null> {
    const result = await this.db.query<RegistryRow>(`SELECT definition_id,definition_version,identity,mission,boundaries,authority,escalation,status FROM public.agent_definition_registry WHERE organization_id=$1 AND definition_id=$2 AND definition_version=$3`, [tenantId,id,version]);
    const row=result.rows[0]; if (!row) return null;
    return { id: row.definition_id, version: row.definition_version, identity: row.identity, mission: row.mission, boundaries: boundariesFromRow(row.boundaries), authority: row.authority, escalation: row.escalation, status: row.status };
  }
}
