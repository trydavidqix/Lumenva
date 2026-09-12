/** Minimal provider-free Action Bus for one mock BrowserMesh action. */

export type ActionEnvelope = {
  action_id: string;
  organization_id: string;
  assignment_id: string;
  session_id?: string;
  action_type: string;
  target_ref: string;
  permission_level: "P0" | "P1" | "P2" | "P3" | "P4";
  risk_level: "R0" | "R1" | "R2" | "R3" | "R4";
  approval_id?: string;
  idempotency_key: string;
  timeout_ms: number;
  retry_policy: string;
  payload_redacted: unknown;
};

export type BrowserMeshWorker = {
  worker_id: string;
  agent_id: string;
  organization_id: string;
  capabilities: string[];
  allowlisted_action_types: string[];
};

export type ActionEvidence = {
  action_id: string;
  assignment_id: string;
  worker_id: string;
  action_type: string;
  result: unknown;
  persisted_at: string;
};

export type ActionReceipt = {
  action_id: string;
  idempotency_key: string;
  status: "PERSISTED";
  evidence_ref: string;
};

export type ActionResult = {
  status: "SLEEPING";
  receipt: ActionReceipt;
  evidence: ActionEvidence;
};

export class ActionBus {
  private readonly evidence = new Map<string, ActionEvidence>();
  private readonly receipts = new Map<string, ActionReceipt>();

  async execute(
    worker: BrowserMeshWorker,
    action: ActionEnvelope,
    adapter: (action: ActionEnvelope) => Promise<unknown>,
  ): Promise<ActionResult> {
    const replay = this.receipts.get(action.idempotency_key);
    if (replay) return { status: "SLEEPING", receipt: { ...replay }, evidence: structuredClone(this.evidence.get(action.idempotency_key)!) };
    if (worker.organization_id !== action.organization_id) throw new Error("action_tenant_mismatch");
    if (!worker.capabilities.includes(action.action_type)) throw new Error("action_capability_denied");
    if (!worker.allowlisted_action_types.includes(action.action_type)) throw new Error("action_not_allowlisted");

    const result = await adapter(action);
    const evidence: ActionEvidence = {
      action_id: action.action_id,
      assignment_id: action.assignment_id,
      worker_id: worker.worker_id,
      action_type: action.action_type,
      result,
      persisted_at: new Date().toISOString(),
    };
    const receipt: ActionReceipt = {
      action_id: action.action_id,
      idempotency_key: action.idempotency_key,
      status: "PERSISTED",
      evidence_ref: action.idempotency_key,
    };
    this.evidence.set(action.idempotency_key, structuredClone(evidence));
    this.receipts.set(action.idempotency_key, receipt);
    return { status: "SLEEPING", receipt: { ...receipt }, evidence: structuredClone(evidence) };
  }

  getEvidence(idempotencyKey: string): ActionEvidence | undefined {
    const evidence = this.evidence.get(idempotencyKey);
    return evidence ? structuredClone(evidence) : undefined;
  }
}
