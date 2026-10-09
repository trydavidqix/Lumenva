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
    .in('external_provider', ['nuvemshop']) // Ensure isolation from standard CRM orders
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

  // Additional constraint: confirmed transitions must come from a verified provider callback/webhook,
  // not via the human agent requireRole boundary.
  if (input.nextState === 'confirmed') {
    throw new Error('BLOCKED: confirmed transitions must be driven by verified provider webhooks, not agent operations.');
  }

  // Validate snapshot constraints for specific transitions
  if (input.nextState === 'approved') {
    // Transitioning TO approved STRICTLY requires the snapshot to be present and match
    if (!input.snapshot) {
      throw new Error('Cannot approve without providing an approval snapshot.');
    }
    const serverSnapshot = currentDropshipping?.approval_snapshot;
    if (!serverSnapshot) {
      throw new Error('BLOCKED: Cannot approve order. A canonical server-side snapshot builder/contract is missing from dropshipping domain, meaning there is no trusted server snapshot to verify against.');
    }
    if (JSON.stringify(input.snapshot) !== JSON.stringify(serverSnapshot)) {
      throw new Error('Stale snapshot: Provided snapshot does not match the currently stored snapshot.');
    }
  } else if (['submitted', 'confirmed'].includes(input.nextState)) {
    // If moving PAST approved, ensure there's a valid snapshot on the server
    if (!currentDropshipping?.approval_snapshot) {
      throw new Error('Cannot transition beyond approved without a valid approval snapshot on the server.');
    }
  } else if (input.nextState === 'reviewed') {
     // A reviewed transition CANNOT persist a client-supplied snapshot as authoritative.
     // It must rely on a canonical server-side builder, which is missing.
     if (input.snapshot !== undefined) {
         throw new Error('BLOCKED: Cannot persist client-supplied snapshot on review. A canonical server-side snapshot builder is required but missing.');
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
    .in('external_provider', ['nuvemshop'])
    .select('id')
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to update order: ${updateError.message}`);
  }

  if (!updateData) {
    throw new Error('Concurrency conflict: Order was updated by another process (CAS failed)');
  }
}
