/** Minimal provider-free Action Bus for one mock BrowserMesh action. */
export type ActionEnvelope = { action_id: string; organization_id: string; actor_id: string; assignment_id: string; session_id?: string; action_type: string; target_ref: string; permission_level: "P0" | "P1" | "P2" | "P3" | "P4"; risk_level: "R0" | "R1" | "R2" | "R3" | "R4" | "high"; approval_id?: string; idempotency_key: string; timeout_ms: number; retry_policy: string; payload_redacted: unknown };
export type ApprovalRecord = { approval_id: string; organization_id: string; actor_id: string; assignment_id: string; expires_at: string };
export type AuthorizedActor = { actor_id: string; organization_id: string; capabilities: readonly string[]; enabled?: boolean };
export class ActorRegistry {
  private readonly actors = new Map<string, AuthorizedActor>();
  constructor(actors: readonly AuthorizedActor[] = []) { for (const actor of actors) this.actors.set(`${actor.organization_id}:${actor.actor_id}`, { ...actor, capabilities: [...actor.capabilities] }); }
  get(organizationId: string, actorId: string): AuthorizedActor | undefined { return this.actors.get(`${organizationId}:${actorId}`); }
  authorize(organizationId: string, actorId: string, actionType: string): boolean { const actor = this.get(organizationId, actorId); return actor !== undefined && actor.enabled !== false && actor.capabilities.includes(actionType); }
}
export type BrowserMeshWorker = { worker_id: string; agent_id: string; organization_id: string; capabilities: string[]; allowlisted_action_types: string[] };
export type ActionEvidence = { action_id: string; assignment_id: string; worker_id: string; action_type: string; result: unknown; persisted_at: string };
export type ActionReceipt = { action_id: string; idempotency_key: string; status: "PERSISTED"; evidence_ref: string };
export type ActionResult = { status: "SLEEPING"; receipt: ActionReceipt; evidence: ActionEvidence };
const sensitive = /(api[_ -]?key|token|secret|password|credential|bearer)\s*[:=]\s*[^\s,;]+/gi;
const MAX_STRING = 4096;
function redact(value: unknown): unknown { if (typeof value === "string") return value.replace(sensitive, "$1=[REDACTED]").slice(0, MAX_STRING); if (Array.isArray(value)) return value.map(redact); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /(?:api[_ -]?key|token|secret|password|credential|bearer)/i.test(key) ? "[REDACTED]" : redact(item)])); return value; }
function validateAction(worker: BrowserMeshWorker, action: ActionEnvelope, approvals: readonly ApprovalRecord[], actorRegistry: ActorRegistry): void {
  if (!worker || !action || worker.organization_id !== action.organization_id) throw new Error("action_tenant_mismatch");
  if (!action.actor_id) throw new Error("action_actor_required");
  const actor = actorRegistry.get(action.organization_id, action.actor_id);
  if (!actor || actor.enabled === false) throw new Error("action_actor_not_authorized");
  if (!actor.capabilities.includes(action.action_type)) throw new Error("action_actor_capability_denied");
  if (!worker.capabilities.includes(action.action_type)) throw new Error("action_capability_denied");
  if (!worker.allowlisted_action_types.includes(action.action_type)) throw new Error("action_not_allowlisted");
  if (!/^P[0-4]$/.test(action.permission_level) || (!/^R[0-4]$/.test(action.risk_level) && action.risk_level !== "high")) throw new Error("action_policy_invalid");
  const risk = Math.max(Number(action.permission_level.slice(1)), action.risk_level === "high" ? 4 : Number(action.risk_level.slice(1)));
  if (risk >= 2) {
    if (!action.approval_id) throw new Error("action_approval_required");
    const approval = approvals.find((item) => item.approval_id === action.approval_id && item.organization_id === action.organization_id && item.actor_id === action.actor_id && item.assignment_id === action.assignment_id);
    if (!approval || !Number.isFinite(Date.parse(approval.expires_at)) || Date.parse(approval.expires_at) <= Date.now()) throw new Error("action_approval_not_preapproved");
  }
  if (!action.idempotency_key) throw new Error("action_idempotency_required");
}
export class ActionBus {
  private readonly evidence = new Map<string, ActionEvidence>(); private readonly receipts = new Map<string, ActionReceipt>(); private readonly inFlight = new Map<string, Promise<ActionResult>>();
  constructor(private readonly approvals: readonly ApprovalRecord[] = [], private readonly actorRegistry: ActorRegistry = new ActorRegistry()) {}
  async execute(worker: BrowserMeshWorker, action: ActionEnvelope, adapter: (action: ActionEnvelope) => Promise<unknown>): Promise<ActionResult> {
    validateAction(worker, action, this.approvals, this.actorRegistry);
    const key = `${action.organization_id}:${worker.worker_id}:${action.action_id}:${action.idempotency_key}`;
    const replay = this.receipts.get(key); if (replay) return { status: "SLEEPING", receipt: { ...replay }, evidence: structuredClone(this.evidence.get(key)!) };
    const pending = this.inFlight.get(key); if (pending) return pending;
    const operation = this.runOnce(worker, { ...action, payload_redacted: redact(action.payload_redacted) }, key, adapter); this.inFlight.set(key, operation);
    try { return await operation; } finally { this.inFlight.delete(key); }
  }
  private async runOnce(worker: BrowserMeshWorker, action: ActionEnvelope, key: string, adapter: (action: ActionEnvelope) => Promise<unknown>): Promise<ActionResult> {
    const evidence: ActionEvidence = { action_id: action.action_id, assignment_id: action.assignment_id, worker_id: worker.worker_id, action_type: action.action_type, result: redact(await adapter(action)), persisted_at: new Date().toISOString() };
    const receipt: ActionReceipt = { action_id: action.action_id, idempotency_key: action.idempotency_key, status: "PERSISTED", evidence_ref: key }; this.evidence.set(key, structuredClone(evidence)); this.receipts.set(key, receipt);
    return { status: "SLEEPING", receipt: { ...receipt }, evidence: structuredClone(evidence) };
  }
  getEvidence(idempotencyKey: string): ActionEvidence | undefined { for (const [key, evidence] of this.evidence) if (key.endsWith(`:${idempotencyKey}`)) return structuredClone(evidence); return undefined; }
}
