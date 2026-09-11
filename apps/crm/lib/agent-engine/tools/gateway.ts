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
import { authorizeModule, type AuthorizeModuleInput, type AuthorizationDecision } from '@/lib/entitlements/authorize-module';

export type ToolGatewayResult =
  | { kind: 'executed'; result: unknown }
  | { kind: 'denied'; reason: string; receipt?: AuthorizationDecision }
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
  runtimeAutonomyStore?: { load: (key: { organizationId: string; agentId: string; capabilityId: string }) => Promise<{ globalEnabled?: boolean; tenantEnabled?: boolean; agentEnabled?: boolean; capabilityEnabled?: boolean } | null> };
  autonomyEvidenceRecorder?: AutonomyEvidenceRecorder;
  tool: AgentToolDefinition;
  args: unknown;
  idempotencyKey: string;
  execute: () => Promise<unknown> | unknown;
  approvalStore: ApprovalStore | null;
  /** Compatibility input: omission is fail-closed and never executes the tool. */
  entitlement?: AuthorizeModuleInput;
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
  if (input.runtimeAutonomyStore && !input.runtimeAutonomyResolver) {
    input.runtimeAutonomyResolver = {
      async resolve(key) {
        const state = await input.runtimeAutonomyStore!.load(key);
        return {
          level: input.autonomyLevel,
          globalEnabled: state?.globalEnabled ?? true,
          tenantEnabled: state?.tenantEnabled ?? true,
          agentEnabled: state?.agentEnabled ?? true,
          capabilityEnabled: state?.capabilityEnabled ?? true,
        };
      },
    };
  }

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

  if (!input.entitlement) {
    const receipt: AuthorizationDecision = {
      decision: 'DENY',
      reason: 'authorization_contract_invalid',
      policyVersion: 'entitlements.v1',
      audit: {
        requestId: input.idempotencyKey,
        moduleId: input.tool.id,
        moduleVersion: 'unknown',
        organizationId: input.organizationId,
        plan: 'unknown',
        actorId: input.agentId,
        policyVersion: 'entitlements.v1',
        checks: [],
      },
    };
    await emit({ policyOutcome: 'deny', executionOutcome: 'entitlement:authorization_contract_invalid' });
    return { kind: 'denied', reason: 'entitlement:authorization_contract_invalid', receipt };
  }

  const entitlement = authorizeModule(input.entitlement);
  if (entitlement.decision === 'DENY') {
    await emit({ policyOutcome: 'deny', executionOutcome: `entitlement:${entitlement.reason}` });
    return { kind: 'denied', reason: `entitlement:${entitlement.reason}`, receipt: entitlement };
  }

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

/** Adapter for the kernel port used by the canonical Agent Kernel composition. */
export function createKernelToolGatewayPort(input: {
  registry: { get(toolId: string): AgentToolDefinition | null | undefined };
  approvalStore: ApprovalStore | null;
  executeTool: (tool: AgentToolDefinition, args: unknown) => Promise<unknown> | unknown;
}) {
  return {
    async execute(request: {
      execution: { organizationId: string; agentId: string; runId: string };
      tool: { id: string; risk: AgentToolDefinition['risk']; hasSideEffect: boolean; idempotencyRequired: boolean };
      args: unknown;
      idempotencyKey: string;
    }) {
      const definition = input.registry.get(request.tool.id);
      if (!definition) return { kind: 'denied' as const, reason: 'tool_not_registered' };
      const result = await executeThroughToolGateway({
        organizationId: request.execution.organizationId,
        agentId: request.execution.agentId,
        runId: request.execution.runId,
        autonomyLevel: 'assisted',
        tool: definition,
        args: request.args,
        idempotencyKey: request.idempotencyKey,
        execute: () => input.executeTool(definition, request.args),
        approvalStore: input.approvalStore,
      });
      if (result.kind === 'pending_approval') {
        return { kind: 'approval_required' as const, reason: 'approval_required', approvalId: result.approvalId };
      }
      return result;
    },
  };
}

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
