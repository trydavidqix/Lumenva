import type { Queryable } from "../agent-engine/queue/queue";
import type { ActorRegistry, ActionEnvelope } from "../agent-engine/wave4/action-bus";

export type AuthenticatedRequester = { organizationId: string; actorId: string };
export type EvolutionReceipt = { organizationId: string; actorId: string; actionId: string; idempotencyKey: string; status: "PERSISTED"; createdAt: string };
export class EvolutionPermissionError extends Error { constructor(readonly code: "REQUESTER_UNAUTHENTICATED" | "REQUESTER_MISMATCH" | "ACTOR_UNAUTHORIZED", message: string) { super(message); } }
export function assertAuthenticatedRequester(requester: AuthenticatedRequester | null | undefined, action: ActionEnvelope, actors: ActorRegistry): void {
  if (!requester?.organizationId || !requester.actorId) throw new EvolutionPermissionError("REQUESTER_UNAUTHENTICATED", "evolution_requester_required");
  if (requester.organizationId !== action.organization_id || requester.actorId !== action.actor_id) throw new EvolutionPermissionError("REQUESTER_MISMATCH", "evolution_requester_mismatch");
  if (!actors.authorize(requester.organizationId, requester.actorId, action.action_type)) throw new EvolutionPermissionError("ACTOR_UNAUTHORIZED", "evolution_actor_not_authorized");
}
export class PostgresEvolutionReceiptStore {
  constructor(private readonly db: Queryable, private readonly table = "agent_evolution_receipts") { if (!/^\w+$/.test(table)) throw new Error("evolution_table_invalid"); }
  async persist(requester: AuthenticatedRequester | null | undefined, action: ActionEnvelope, actors: ActorRegistry): Promise<{ created: boolean; receipt: EvolutionReceipt }> {
    assertAuthenticatedRequester(requester, action, actors);
    const result = await this.db.query<EvolutionReceipt>(`INSERT INTO ${this.table} (organization_id, actor_id, action_id, idempotency_key, status) VALUES ($1,$2,$3,$4,'PERSISTED') ON CONFLICT (organization_id, actor_id, action_id, idempotency_key) DO NOTHING RETURNING organization_id AS "organizationId", actor_id AS "actorId", action_id AS "actionId", idempotency_key AS "idempotencyKey", status, created_at AS "createdAt"`, [action.organization_id, action.actor_id, action.action_id, action.idempotency_key]);
    if (result.rows[0]) return { created: true, receipt: result.rows[0] };
    const existing = await this.db.query<EvolutionReceipt>(`SELECT organization_id AS "organizationId", actor_id AS "actorId", action_id AS "actionId", idempotency_key AS "idempotencyKey", status, created_at AS "createdAt" FROM ${this.table} WHERE organization_id=$1 AND actor_id=$2 AND action_id=$3 AND idempotency_key=$4`, [action.organization_id, action.actor_id, action.action_id, action.idempotency_key]);
    if (!existing.rows[0]) throw new Error("evolution_receipt_missing");
    return { created: false, receipt: existing.rows[0] };
  }
}
