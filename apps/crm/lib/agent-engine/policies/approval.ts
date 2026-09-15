import { randomUUID } from 'node:crypto';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'executing'
  | 'executed'
  | 'expired'
  | 'cancelled';

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  runId: string;
  agentId: string;
  toolId: string;
  approvalType: string;
  idempotencyKey: string;
  reason: string;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt?: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  executedAt?: string;
}

export interface ApprovalStore {
  save(request: ApprovalRequest): Promise<void>;
  load(id: string): Promise<ApprovalRequest | null>;
  compareAndSet(id: string, expectedStatus: ApprovalStatus, next: ApprovalRequest): Promise<boolean>;
}

const executionLocks = new Map<string, Promise<void>>();

export interface CreateApprovalRequestInput {
  organizationId: string;
  runId: string;
  agentId: string;
  toolId: string;
  approvalType: string;
  idempotencyKey: string;
  reason: string;
  expiresAt?: string;
}

export interface ApprovalDecisionInput {
  decision: 'approved' | 'denied';
  decidedBy: string;
  reason?: string;
}

export interface ApprovalGuard {
  organizationId?: string;
  runTerminal?: boolean;
}

export type ApprovalExecutionResult =
  | { kind: 'pending_approval'; approvalId: string }
  | {
      kind: 'denied';
      reason: 'approval_denied' | 'approval_expired' | 'approval_cancelled';
    }
  | { kind: 'executed'; result: unknown }
  | { kind: 'already_executed' };

function requireApproval(
  request: ApprovalRequest | null,
  approvalId: string,
  guard?: ApprovalGuard,
): ApprovalRequest {
  if (!request) {
    throw new Error(`approval_not_found:${approvalId}`);
  }
  if (
    guard?.organizationId !== undefined &&
    request.organizationId !== guard.organizationId
  ) {
    throw new Error('approval_tenant_mismatch');
  }
  return request;
}

function isFinalDecision(status: ApprovalStatus): boolean {
  return status !== 'pending';
}

export async function createApprovalRequest(
  store: ApprovalStore,
  input: CreateApprovalRequestInput,
): Promise<ApprovalRequest> {
  const request: ApprovalRequest = {
    id: randomUUID(),
    organizationId: input.organizationId,
    runId: input.runId,
    agentId: input.agentId,
    toolId: input.toolId,
    approvalType: input.approvalType,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
  };

  await store.save(request);
  return request;
}

export async function decideApprovalRequest(
  store: ApprovalStore,
  approvalId: string,
  decision: ApprovalDecisionInput,
  guard?: ApprovalGuard,
): Promise<ApprovalRequest> {
  const request = requireApproval(await store.load(approvalId), approvalId, guard);

  if (guard?.runTerminal === true) {
    throw new Error('approval_run_terminal');
  }

  // First terminal decision wins. A later concurrent/replayed decision cannot
  // overwrite the durable result observed by this worker.
  if (isFinalDecision(request.status)) {
    return request;
  }

  const next: ApprovalRequest = {
    ...request,
    status: decision.decision,
    decidedAt: new Date().toISOString(),
    decidedBy: decision.decidedBy,
    ...(decision.reason === undefined ? {} : { decisionReason: decision.reason }),
  };

  const committed = await store.compareAndSet(request.id, 'pending', next);
  if (committed) return next;
  return requireApproval(await store.load(approvalId), approvalId, guard);
}

export async function expireApprovalRequest(
  store: ApprovalStore,
  approvalId: string,
  input: { organizationId: string; now: string },
): Promise<ApprovalRequest> {
  const request = requireApproval(await store.load(approvalId), approvalId, {
    organizationId: input.organizationId,
  });
  if (request.status !== 'pending') return request;
  if (request.expiresAt === undefined || Date.parse(input.now) < Date.parse(request.expiresAt)) {
    return request;
  }

  const expired: ApprovalRequest = {
    ...request,
    status: 'expired',
    decidedAt: input.now,
    decisionReason: 'approval_expired',
  };
  if (store.compareAndSet) {
    const committed = await store.compareAndSet(request.id, 'pending', expired);
    return committed ? expired : requireApproval(await store.load(approvalId), approvalId, { organizationId: input.organizationId });
  }
  await store.save(expired);
  return expired;
}

export async function cancelApprovalRequest(
  store: ApprovalStore,
  approvalId: string,
  input: { organizationId: string; cancelledBy: string; reason?: string },
): Promise<ApprovalRequest> {
  const request = requireApproval(await store.load(approvalId), approvalId, {
    organizationId: input.organizationId,
  });
  if (request.status !== 'pending') return request;

  const cancelled: ApprovalRequest = {
    ...request,
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelledBy: input.cancelledBy,
    ...(input.reason === undefined ? {} : { decisionReason: input.reason }),
  };
  if (store.compareAndSet) {
    const committed = await store.compareAndSet(request.id, 'pending', cancelled);
    return committed ? cancelled : requireApproval(await store.load(approvalId), approvalId, { organizationId: input.organizationId });
  }
  await store.save(cancelled);
  return cancelled;
}

export async function enforceApprovalDecision(
  store: ApprovalStore,
  approvalId: string,
  execute: (request: ApprovalRequest) => Promise<unknown> | unknown,
  guard?: Pick<ApprovalGuard, 'organizationId'>,
): Promise<ApprovalExecutionResult> {
  const previous = executionLocks.get(approvalId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  executionLocks.set(approvalId, queued);
  await previous;
  try {
    return await enforceApprovalDecisionLocked(store, approvalId, execute, guard);
  } finally {
    release();
    if (executionLocks.get(approvalId) === queued) executionLocks.delete(approvalId);
  }
}

async function enforceApprovalDecisionLocked(
  store: ApprovalStore,
  approvalId: string,
  execute: (request: ApprovalRequest) => Promise<unknown> | unknown,
  guard?: Pick<ApprovalGuard, 'organizationId'>,
): Promise<ApprovalExecutionResult> {
  const request = requireApproval(await store.load(approvalId), approvalId, guard);

  if (request.status === 'pending') {
    return { kind: 'pending_approval', approvalId: request.id };
  }
  if (request.status === 'denied') {
    return { kind: 'denied', reason: 'approval_denied' };
  }
  if (request.status === 'expired') {
    return { kind: 'denied', reason: 'approval_expired' };
  }
  if (request.status === 'cancelled') {
    return { kind: 'denied', reason: 'approval_cancelled' };
  }
  if (request.status === 'executed') {
    return { kind: 'already_executed' };
  }

  // Persist the claim before invoking the capability. If the process crashes
  // after the external call but before the final save, resume observes the
  // same approval + idempotencyKey and retries through the tool's mandatory
  // idempotency boundary rather than minting a new execution identity.
  const executing: ApprovalRequest =
    request.status === 'executing'
      ? request
      : {
          ...request,
          status: 'executing',
        };
  if (request.status !== 'executing') {
    if (store.compareAndSet) {
      const committed = await store.compareAndSet(request.id, 'approved', executing);
      if (!committed) {
        const latest = requireApproval(await store.load(approvalId), approvalId, guard);
        if (latest.status !== 'executing') return enforceApprovalDecisionLocked(store, approvalId, execute, guard);
        return { kind: 'already_executed' };
      }
    } else {
      await store.save(executing);
    }
  }

  const result = await execute(executing);
  const executed: ApprovalRequest = {
    ...executing,
    status: 'executed',
    executedAt: new Date().toISOString(),
  };
  await store.save(executed);

  return { kind: 'executed', result };
}
