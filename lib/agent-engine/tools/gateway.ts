import type { PromotionDecision } from '../autonomy/promotion';
import { mostRestrictiveAutonomyLevel, type RuntimeAutonomyResolver } from '../autonomy/decision';
import {
  buildAutonomyDecisionEvidence,
  recordAutonomyDecision,
  type AutonomyEvidenceRecorder,
} from '../autonomy/evidence';
import type { ApprovalStore } from '../policies/approval';
import { createApprovalRequest } from '../policies/approval';
import {
  evaluateToolPolicy,
  type AgentAutonomyLevel,
  type ToolPolicyOverrides,
} from '../policies/engine';
import type { AgentToolDefinition } from './registry';

export type ToolGatewayResult =
  | { kind: 'executed'; result: unknown }
  | { kind: 'denied'; reason: string }
  | { kind: 'draft'; proposal: { toolId: string; args: unknown; idempotencyKey: string } }
  | { kind: 'pending_approval'; approvalId: string };

export interface ExecuteThroughToolGatewayInput {
  organizationId: string;
  agentId: string;
  runId?: string;
  traceId?: string;
  correlationId?: string;
  autonomyLevel: AgentAutonomyLevel;
  tenantPolicy?: ToolPolicyOverrides;
  agentPolicy?: ToolPolicyOverrides;
  promotionDecision?: PromotionDecision;
  runtimeAutonomyResolver?: RuntimeAutonomyResolver;
  autonomyEvidenceRecorder?: AutonomyEvidenceRecorder;
  tool: AgentToolDefinition;
  args: unknown;
  idempotencyKey: string;
  execute: () => Promise<unknown> | unknown;
  approvalStore: ApprovalStore | null;
}

function disabledReason(input: {
  globalEnabled: boolean;
  tenantEnabled: boolean;
  agentEnabled: boolean;
  capabilityEnabled: boolean;
}): string | null {
  if (!input.globalEnabled) return 'global_kill_switch';
  if (!input.tenantEnabled) return 'tenant_kill_switch';
  if (!input.agentEnabled) return 'agent_kill_switch';
  if (!input.capabilityEnabled) return 'capability_kill_switch';
  return null;
}

export async function executeThroughToolGateway(
  input: ExecuteThroughToolGatewayInput,
): Promise<ToolGatewayResult> {
  const runId = input.runId ?? `gateway:${input.idempotencyKey}`;
  const traceId = input.traceId ?? runId;
  const correlationId = input.correlationId ?? traceId;
  let effectiveLevel = input.autonomyLevel;

  const emit = async (details: {
    policyOutcome: string;
    approvalId?: string | null;
    approvalStatus?: string | null;
    executionOutcome: string;
  }) => {
    await recordAutonomyDecision(
      input.autonomyEvidenceRecorder,
      buildAutonomyDecisionEvidence({
        organizationId: input.organizationId,
        agentId: input.agentId,
        runId,
        capabilityId: input.tool.id,
        autonomyLevel: effectiveLevel,
        riskTier: input.tool.risk,
        promotionEvidenceRef:
          input.promotionDecision?.kind === 'allow'
            ? input.promotionDecision.evidenceRef
            : null,
        policyOutcome: details.policyOutcome,
        approvalId: details.approvalId ?? null,
        approvalStatus: details.approvalStatus ?? null,
        executionOutcome: details.executionOutcome,
        traceId,
        correlationId,
      }),
    );
  };

  if (input.tool.idempotencyRequired && input.idempotencyKey.trim().length === 0) {
    await emit({ policyOutcome: 'deny', executionOutcome: 'idempotency_key_required' });
    return { kind: 'denied', reason: 'idempotency_key_required' };
  }

  if (input.tool.hasSideEffect && input.runtimeAutonomyResolver) {
    const runtime = await input.runtimeAutonomyResolver.resolve({
      organizationId: input.organizationId,
      agentId: input.agentId,
      capabilityId: input.tool.id,
    });
    const reason = disabledReason(runtime);
    if (reason) {
      effectiveLevel = 'off';
      await emit({ policyOutcome: 'deny', executionOutcome: reason });
      return { kind: 'denied', reason };
    }
    effectiveLevel = mostRestrictiveAutonomyLevel(input.autonomyLevel, runtime.level);
  }

  const policy = evaluateToolPolicy({
    organizationId: input.organizationId,
    agentId: input.agentId,
    autonomyLevel: effectiveLevel,
    tool: input.tool,
    tenantPolicy: input.tenantPolicy,
    agentPolicy: input.agentPolicy,
    promotionDecision: input.promotionDecision,
  });

  if (policy.kind === 'deny') {
    await emit({ policyOutcome: policy.kind, executionOutcome: policy.reason });
    return { kind: 'denied', reason: policy.reason };
  }

  if (policy.kind === 'draft') {
    await emit({ policyOutcome: policy.kind, executionOutcome: 'draft_proposed' });
    return {
      kind: 'draft',
      proposal: { toolId: input.tool.id, args: input.args, idempotencyKey: input.idempotencyKey },
    };
  }

  if (policy.kind === 'require_approval') {
    if (!input.approvalStore) {
      await emit({ policyOutcome: policy.kind, executionOutcome: 'approval_store_unavailable' });
      return { kind: 'denied', reason: 'approval_store_unavailable' };
    }

    const request = await createApprovalRequest(input.approvalStore, {
      organizationId: input.organizationId,
      runId,
      agentId: input.agentId,
      toolId: input.tool.id,
      approvalType: policy.approvalType,
      idempotencyKey: input.idempotencyKey,
      reason: policy.reason,
    });
    await emit({
      policyOutcome: policy.kind,
      approvalId: request.id,
      approvalStatus: request.status,
      executionOutcome: 'pending_approval',
    });
    return { kind: 'pending_approval', approvalId: request.id };
  }

  const result = await input.execute();
  await emit({ policyOutcome: policy.kind, executionOutcome: 'executed' });
  return { kind: 'executed', result };
}

export type ExecutableTool = {
  execute?: (args: unknown, options?: unknown) => unknown;
  [key: string]: unknown;
};
export type ToolSetLike = Record<string, ExecutableTool>;

export interface WrapToolSetWithGatewayOptions {
  organizationId: string;
  agentId: string;
  runId?: string;
  traceId?: string;
  correlationId?: string;
  autonomyLevel: AgentAutonomyLevel;
  tenantPolicy?: ToolPolicyOverrides;
  agentPolicy?: ToolPolicyOverrides;
  promotionDecision?: PromotionDecision;
  runtimeAutonomyResolver?: RuntimeAutonomyResolver;
  autonomyEvidenceRecorder?: AutonomyEvidenceRecorder;
  definitions: ReadonlyMap<string, AgentToolDefinition>;
  approvalStore: ApprovalStore | null;
  idempotencyKeyFor: (toolId: string, args: unknown) => string;
}

export function wrapToolSetWithGateway(tools: ToolSetLike, options: WrapToolSetWithGatewayOptions): ToolSetLike {
  const wrapped: ToolSetLike = {};
  for (const [toolId, definition] of Object.entries(tools)) {
    if (typeof definition.execute !== 'function') {
      wrapped[toolId] = definition;
      continue;
    }
    const metadata = options.definitions.get(toolId);
    const originalExecute = definition.execute.bind(definition);
    wrapped[toolId] = {
      ...definition,
      execute: async (args: unknown, executeOptions?: unknown): Promise<ToolGatewayResult> => {
        if (!metadata) return { kind: 'denied', reason: 'tool_not_registered' };
        return executeThroughToolGateway({
          organizationId: options.organizationId,
          agentId: options.agentId,
          runId: options.runId,
          traceId: options.traceId,
          correlationId: options.correlationId,
          autonomyLevel: options.autonomyLevel,
          tenantPolicy: options.tenantPolicy,
          agentPolicy: options.agentPolicy,
          promotionDecision: options.promotionDecision,
          runtimeAutonomyResolver: options.runtimeAutonomyResolver,
          autonomyEvidenceRecorder: options.autonomyEvidenceRecorder,
          tool: metadata,
          args,
          idempotencyKey: options.idempotencyKeyFor(toolId, args),
          approvalStore: options.approvalStore,
          execute: () => originalExecute(args, executeOptions),
        });
      },
    };
  }
  return wrapped;
}
