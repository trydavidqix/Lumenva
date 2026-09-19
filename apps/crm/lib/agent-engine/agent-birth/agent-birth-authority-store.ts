import type { AgentDefinitionApproval, AgentDefinitionOrigin } from "./agent-definition";

export type TrustedAgentActor = AgentDefinitionOrigin & {
  actor_type: "HUMAN" | "AGENT" | "SYSTEM" | "OWNER_GATEWAY";
  active: boolean;
};

export type TrustedAgentApproval = AgentDefinitionApproval & {
  definition_id: string;
  definition_version: string;
  author_actor_id: string;
};

export type AgentBirthAuthorityInput = {
  tenantId: string;
  definitionId: string;
  definitionVersion: string;
  origin: AgentDefinitionOrigin;
  approvalId: string;
  approverId: string;
};

export interface AgentBirthAuthorityStore {
  verify(input: AgentBirthAuthorityInput): Promise<{ origin: TrustedAgentActor; approval: TrustedAgentApproval }>;
}

export class AgentBirthAuthorityError extends Error {
  constructor(readonly code: "origin_not_authoritative" | "approval_not_authoritative") {
    super(code);
    this.name = "AgentBirthAuthorityError";
  }
}

export class InMemoryAgentBirthAuthorityStore implements AgentBirthAuthorityStore {
  private readonly actors = new Map<string, TrustedAgentActor>();
  private readonly approvals = new Map<string, TrustedAgentApproval>();

  addActor(actor: TrustedAgentActor): void {
    this.actors.set(`${actor.tenant_id}:${actor.actor_id}`, { ...actor });
  }

  addApproval(approval: TrustedAgentApproval): void {
    this.approvals.set(`${approval.tenant_id}:${approval.approval_id}`, { ...approval });
  }

  async verify(input: AgentBirthAuthorityInput): Promise<{ origin: TrustedAgentActor; approval: TrustedAgentApproval }> {
    if (input.origin.tenant_id !== input.tenantId) throw new AgentBirthAuthorityError("origin_not_authoritative");
    const actor = this.actors.get(`${input.tenantId}:${input.origin.actor_id}`);
    if (!actor || !actor.active || actor.tenant_id !== input.tenantId) {
      throw new AgentBirthAuthorityError("origin_not_authoritative");
    }
    const approval = this.approvals.get(`${input.tenantId}:${input.approvalId}`);
    if (
      !approval ||
      approval.status !== "APPROVED" ||
      approval.tenant_id !== input.tenantId ||
      approval.definition_id !== input.definitionId ||
      approval.definition_version !== input.definitionVersion ||
      approval.author_actor_id !== actor.actor_id ||
      approval.approver_id !== input.approverId
    ) {
      throw new AgentBirthAuthorityError("approval_not_authoritative");
    }
    return { origin: { ...actor }, approval: { ...approval } };
  }
}

export interface AuthorityQueryable {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }>;
}

export function createPostgresAgentBirthAuthorityStore(db: AuthorityQueryable): AgentBirthAuthorityStore {
  return {
    async verify(input) {
      if (input.origin.tenant_id !== input.tenantId) throw new AgentBirthAuthorityError("origin_not_authoritative");
      const actorResult = await db.query<TrustedAgentActor>(
        `select actor_id, tenant_id, actor_type, active
           from public.agent_birth_actors
          where tenant_id = $1 and actor_id = $2 and active = true`,
        [input.tenantId, input.origin.actor_id],
      );
      const actor = actorResult.rows[0];
      if (!actor) throw new AgentBirthAuthorityError("origin_not_authoritative");

      const approvalResult = await db.query<TrustedAgentApproval>(
        `select approval_id, tenant_id, definition_id, definition_version,
                author_actor_id, approver_id, status, approved_at, policy_version
           from public.agent_birth_approvals
          where tenant_id = $1
            and approval_id = $2
            and definition_id = $3
            and definition_version = $4
            and author_actor_id = $5
            and approver_id = $6
            and status = 'APPROVED'`,
        [input.tenantId, input.approvalId, input.definitionId, input.definitionVersion, actor.actor_id, input.approverId],
      );
      const approval = approvalResult.rows[0];
      if (!approval) throw new AgentBirthAuthorityError("approval_not_authoritative");
      return { origin: { ...actor }, approval: { ...approval } };
    },
  };
}

