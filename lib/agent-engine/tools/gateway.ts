import type { ResolvedKernelExecution } from "../kernel/contracts";
import type { KernelToolGatewayPort } from "../kernel/ports";
import type { ApprovalStore } from "../policies/approval";
import { createApprovalRequest } from "../policies/approval";
import { evaluateToolPolicy, type AgentAutonomyLevel, type ToolPolicyOverrides } from "../policies/engine";
import { loadRuntimeAutonomyControls, type RuntimeAutonomyStore } from "../policies/runtime-controls";
import type { AgentToolDefinition } from "./registry";

export type ToolGatewayResult =
  | { kind: "executed"; result: unknown }
  | { kind: "denied"; reason: string }
  | { kind: "draft"; proposal: { toolId: string; args: unknown; idempotencyKey: string } }
  | { kind: "pending_approval"; approvalId: string; reason: string };

export interface ExecuteThroughToolGatewayInput {
  organizationId: string;
  agentId: string;
  runId: string;
  autonomyLevel: AgentAutonomyLevel;
  tenantPolicy?: ToolPolicyOverrides;
  agentPolicy?: ToolPolicyOverrides;
  promotionEvidencePassed?: boolean;
  runtimeAutonomyStore?: RuntimeAutonomyStore;
  tool: AgentToolDefinition;
  args: unknown;
  idempotencyKey: string;
  execute: () => Promise<unknown> | unknown;
  approvalStore: ApprovalStore | null;
}

export async function executeThroughToolGateway(input: ExecuteThroughToolGatewayInput): Promise<ToolGatewayResult> {
  if (input.tool.idempotencyRequired && input.idempotencyKey.trim().length === 0) {
    return { kind: "denied", reason: "idempotency_key_required" };
  }

  if (input.tool.hasSideEffect && input.runtimeAutonomyStore !== undefined) {
    const runtime = await loadRuntimeAutonomyControls(input.runtimeAutonomyStore, {
      organizationId: input.organizationId,
      agentId: input.agentId,
      capabilityId: input.tool.id,
      autonomyLevel: input.autonomyLevel,
      toolHasSideEffect: input.tool.hasSideEffect,
    });
    if (runtime.kind === "disabled") return { kind: "denied", reason: runtime.reason };
    if (!runtime.canExecuteSideEffects) return { kind: "denied", reason: "runtime_side_effects_disabled" };
  }

  const policy = evaluateToolPolicy({
    organizationId: input.organizationId,
    agentId: input.agentId,
    autonomyLevel: input.autonomyLevel,
    tool: input.tool,
    tenantPolicy: input.tenantPolicy,
    agentPolicy: input.agentPolicy,
    promotionEvidencePassed: input.promotionEvidencePassed,
  });

  if (policy.kind === "deny") return { kind: "denied", reason: policy.reason };
  if (policy.kind === "draft") {
    return {
      kind: "draft",
      proposal: { toolId: input.tool.id, args: input.args, idempotencyKey: input.idempotencyKey },
    };
  }
  if (policy.kind === "require_approval") {
    if (input.approvalStore === null) return { kind: "denied", reason: "approval_store_unavailable" };
    const request = await createApprovalRequest(input.approvalStore, {
      organizationId: input.organizationId,
      runId: input.runId,
      agentId: input.agentId,
      toolId: input.tool.id,
      approvalType: policy.approvalType,
      idempotencyKey: input.idempotencyKey,
      reason: policy.reason,
    });
    return { kind: "pending_approval", approvalId: request.id, reason: policy.reason };
  }

  return { kind: "executed", result: await input.execute() };
}

export type ExecutableTool = {
  execute?: (args: unknown, options?: unknown) => unknown;
  [key: string]: unknown;
};
export type ToolSetLike = Record<string, ExecutableTool>;

export interface WrapToolSetWithGatewayOptions {
  organizationId: string;
  agentId: string;
  runId: string;
  autonomyLevel: AgentAutonomyLevel;
  tenantPolicy?: ToolPolicyOverrides;
  agentPolicy?: ToolPolicyOverrides;
  promotionEvidencePassed?: boolean;
  runtimeAutonomyStore?: RuntimeAutonomyStore;
  definitions: ReadonlyMap<string, AgentToolDefinition>;
  approvalStore: ApprovalStore | null;
  idempotencyKeyFor: (toolId: string, args: unknown) => string;
}

/** Wraps existing CRM/MCP tools; it never replaces their implementation. */
export function wrapToolSetWithGateway(tools: ToolSetLike, options: WrapToolSetWithGatewayOptions): ToolSetLike {
  const wrapped: ToolSetLike = {};
  for (const [toolId, definition] of Object.entries(tools)) {
    if (typeof definition.execute !== "function") {
      wrapped[toolId] = definition;
      continue;
    }
    const metadata = options.definitions.get(toolId);
    const originalExecute = definition.execute.bind(definition);
    wrapped[toolId] = {
      ...definition,
      execute: async (args: unknown, executeOptions?: unknown): Promise<ToolGatewayResult> => {
        if (metadata === undefined) return { kind: "denied", reason: "tool_not_registered" };
        return executeThroughToolGateway({
          organizationId: options.organizationId,
          agentId: options.agentId,
          runId: options.runId,
          autonomyLevel: options.autonomyLevel,
          tenantPolicy: options.tenantPolicy,
          agentPolicy: options.agentPolicy,
          promotionEvidencePassed: options.promotionEvidencePassed,
          runtimeAutonomyStore: options.runtimeAutonomyStore,
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

export interface KernelToolGatewayAdapterOptions {
  registry: ReadonlyMap<string, AgentToolDefinition>;
  approvalStore: ApprovalStore | null;
  runtimeAutonomyStore?: RuntimeAutonomyStore;
  promotionEvidencePassed?: (execution: ResolvedKernelExecution, toolId: string) => boolean;
  executeTool: (input: { execution: ResolvedKernelExecution; toolId: string; args: unknown }) => Promise<unknown>;
}

export function createKernelToolGatewayPort(options: KernelToolGatewayAdapterOptions): KernelToolGatewayPort {
  return {
    async execute({ execution, tool, args, idempotencyKey }) {
      const metadata = options.registry.get(tool.id);
      if (metadata === undefined) return { kind: "denied", reason: "tool_not_registered" };
      const result = await executeThroughToolGateway({
        organizationId: execution.organizationId,
        agentId: execution.agentId,
        runId: execution.runId,
        autonomyLevel: execution.definition.autonomyLevel,
        promotionEvidencePassed: options.promotionEvidencePassed?.(execution, tool.id),
        runtimeAutonomyStore: options.runtimeAutonomyStore,
        tool: metadata,
        args,
        idempotencyKey,
        approvalStore: options.approvalStore,
        execute: () => options.executeTool({ execution, toolId: tool.id, args }),
      });

      if (result.kind === "executed") return result;
      if (result.kind === "pending_approval") {
        return { kind: "approval_required", reason: result.reason, approvalId: result.approvalId };
      }
      if (result.kind === "draft") return { kind: "denied", reason: "draft_side_effects_disabled" };
      return result;
    },
  };
}
