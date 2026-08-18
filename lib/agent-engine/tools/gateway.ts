import type { PromotionDecision } from '../autonomy/promotion';
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
  autonomyLevel: AgentAutonomyLevel;
  tenantPolicy?: ToolPolicyOverrides;
  agentPolicy?: ToolPolicyOverrides;
  promotionDecision?: PromotionDecision;
  tool: AgentToolDefinition;
  args: unknown;
  idempotencyKey: string;
  execute: () => Promise<unknown> | unknown;
  approvalStore: ApprovalStore | null;
}

export async function executeThroughToolGateway(
  input: ExecuteThroughToolGatewayInput,
): Promise<ToolGatewayResult> {
  if (input.tool.idempotencyRequired && input.idempotencyKey.trim().length === 0) {
    return { kind: 'denied', reason: 'idempotency_key_required' };
  }

  const policy = evaluateToolPolicy({
    organizationId: input.organizationId,
    agentId: input.agentId,
    autonomyLevel: input.autonomyLevel,
    tool: input.tool,
    tenantPolicy: input.tenantPolicy,
    agentPolicy: input.agentPolicy,
    promotionDecision: input.promotionDecision,
  });

  if (policy.kind === 'deny') return { kind: 'denied', reason: policy.reason };

  if (policy.kind === 'draft') {
    return {
      kind: 'draft',
      proposal: { toolId: input.tool.id, args: input.args, idempotencyKey: input.idempotencyKey },
    };
  }

  if (policy.kind === 'require_approval') {
    if (!input.approvalStore) return { kind: 'denied', reason: 'approval_store_unavailable' };

    const request = await createApprovalRequest(input.approvalStore, {
      organizationId: input.organizationId,
      runId: input.runId ?? `gateway:${input.idempotencyKey}`,
      agentId: input.agentId,
      toolId: input.tool.id,
      approvalType: policy.approvalType,
      idempotencyKey: input.idempotencyKey,
      reason: policy.reason,
    });
    return { kind: 'pending_approval', approvalId: request.id };
  }

  const result = await input.execute();
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
  autonomyLevel: AgentAutonomyLevel;
  tenantPolicy?: ToolPolicyOverrides;
  agentPolicy?: ToolPolicyOverrides;
  promotionDecision?: PromotionDecision;
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
          autonomyLevel: options.autonomyLevel,
          tenantPolicy: options.tenantPolicy,
          agentPolicy: options.agentPolicy,
          promotionDecision: options.promotionDecision,
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
