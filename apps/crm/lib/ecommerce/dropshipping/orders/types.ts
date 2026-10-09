export type DropshippingWorkflowState =
  | 'received'
  | 'reviewed'
  | 'approved'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'unknown';

export type DropshippingV1Payload = {
  dropshipping_v1?: {
    state: DropshippingWorkflowState;
    actor_id?: string;
    approved_at?: string;
    approval_snapshot?: Record<string, unknown>;
    supplier_id?: string;
    supplier_cost_cents?: number;
    notes?: string;
    error_reason?: string;
  };
};

export type TransitionOrderInput = {
  orderId: string;
  expectedState: DropshippingWorkflowState;
  nextState: DropshippingWorkflowState;
  expectedUpdatedAt: string; // for compare-and-swap
  snapshot?: Record<string, unknown>;
  supplierId?: string;
  supplierCostCents?: number;
  notes?: string;
  errorReason?: string;
};
