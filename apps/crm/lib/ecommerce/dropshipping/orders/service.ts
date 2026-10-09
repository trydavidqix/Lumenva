import { requireRole } from '@/lib/auth/require-role';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TransitionOrderInput, DropshippingV1Payload, DropshippingWorkflowState } from './types';

// Explicit allowed transitions matrix
const ALLOWED_TRANSITIONS: Record<DropshippingWorkflowState, DropshippingWorkflowState[]> = {
  unknown: ['received'],
  received: ['reviewed', 'failed'],
  reviewed: ['approved', 'failed'],
  approved: ['submitted', 'failed'],
  submitted: ['confirmed', 'failed'],
  confirmed: [], // Terminal
  failed: ['received'], // Can reset
};

export async function processDropshippingOrderTransition(input: TransitionOrderInput): Promise<void> {
  const auth = await requireRole('agent');
  if (!auth.ok) {
    throw new Error('Forbidden');
  }
  const { user, org } = auth;
  const organizationId = org.orgId;
  const userId = user.id;

  const supabase = createAdminClient();

  // 1. Fetch current order to check state, concurrent modifications, and payload
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, organization_id, payload, updated_at, external_provider')
    .eq('id', input.orderId)
    .eq('organization_id', organizationId)
    .in('external_provider', ['nuvemshop', 'vtex', 'shopify']) // Ensure isolation from standard CRM orders
    .single();

  if (fetchError || !order) {
    throw new Error('Order not found or access denied');
  }

  // 2. Concurrency check (Compare-and-Swap using updated_at)
  if (order.updated_at !== input.expectedUpdatedAt) {
    throw new Error('Concurrency conflict: Order was updated by another process');
  }

  // 3. State machine validation
  const currentPayload = (order.payload as Record<string, unknown> | null) || {};
  const currentDropshipping = currentPayload.dropshipping_v1 as DropshippingV1Payload['dropshipping_v1'] | undefined;
  const currentState: DropshippingWorkflowState = currentDropshipping?.state || 'unknown';

  if (currentState !== input.expectedState) {
    throw new Error(`Invalid state transition: Expected ${input.expectedState} but got ${currentState}`);
  }

  const allowedNext = ALLOWED_TRANSITIONS[currentState] || [];
  if (!allowedNext.includes(input.nextState)) {
    throw new Error(`Invalid transition from ${currentState} to ${input.nextState}`);
  }

  // Validate snapshot constraints for specific transitions
  if (['approved', 'submitted', 'confirmed'].includes(input.nextState)) {
    // If moving TO approved, or further along, ensure the snapshot is valid.
    // When transitioning from reviewed -> approved, the user provides the snapshot they are approving.
    // If they provided one, it MUST match what's on the server to prevent approving a stale state.
    if (input.snapshot) {
       const serverSnapshot = currentDropshipping?.approval_snapshot;
       if (JSON.stringify(input.snapshot) !== JSON.stringify(serverSnapshot)) {
          throw new Error('Stale snapshot: Provided snapshot does not match the currently stored snapshot.');
       }
    } else {
       // If no snapshot provided in input, ensure there's one on the server if we're moving past approved
       if (input.nextState === 'submitted' && !currentDropshipping?.approval_snapshot) {
          throw new Error('Cannot transition to submitted without a valid approval snapshot.');
       }
    }
  }

  // 4. Update the payload preserving existing structure
  const dsPayload: Exclude<DropshippingV1Payload['dropshipping_v1'], undefined> = {
    ...currentDropshipping,
    state: input.nextState,
    actor_id: userId,
  };

  if (input.nextState === 'approved') {
    dsPayload.approved_at = new Date().toISOString();
  }

  if (input.snapshot !== undefined) {
    dsPayload.approval_snapshot = input.snapshot;
  }
  if (input.supplierId !== undefined) {
    dsPayload.supplier_id = input.supplierId;
  }
  if (input.supplierCostCents !== undefined) {
    dsPayload.supplier_cost_cents = input.supplierCostCents;
  }
  if (input.notes !== undefined) {
    dsPayload.notes = input.notes;
  }
  if (input.errorReason !== undefined) {
    dsPayload.error_reason = input.errorReason;
  }

  const updatedPayload: Record<string, unknown> = {
    ...currentPayload,
    dropshipping_v1: dsPayload,
  };

  // 5. Atomic update enforcing CAS via updated_at and organization isolation
  const { data: updateData, error: updateError } = await supabase
    .from('orders')
    .update({
      payload: updatedPayload,
      updated_at: new Date().toISOString() // refresh updated_at
    })
    .eq('id', input.orderId)
    .eq('updated_at', input.expectedUpdatedAt)
    .eq('organization_id', organizationId)
    .in('external_provider', ['nuvemshop', 'vtex', 'shopify'])
    .select('id')
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to update order: ${updateError.message}`);
  }

  if (!updateData) {
    throw new Error('Concurrency conflict: Order was updated by another process (CAS failed)');
  }
}
