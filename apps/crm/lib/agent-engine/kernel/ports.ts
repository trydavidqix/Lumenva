import type { AgentLoopUsage, AgentRunStatus, ToolRiskLevel } from "../contracts/agent-os";
import type { AgentKernelInput, ResolvedKernelAgent, ResolvedKernelExecution } from "./contracts";

export interface KernelContextBundle {
  authoritative: Record<string, unknown>;
  derivedMemory: Record<string, unknown>;
  sources: string[];
}

export interface KernelSkillBundle {
  activatedSkillVersions: string[];
  index: string;
  bodies: string;
  requestedToolIds?: readonly string[];
}

export interface KernelToolDefinition {
  id: string;
  risk: ToolRiskLevel;
  hasSideEffect: boolean;
  idempotencyRequired: boolean;
}

export interface KernelToolBundle {
  definitions: ReadonlyMap<string, KernelToolDefinition>;
}

export interface KernelModelCandidate {
  id: string;
  provider: string;
  capabilities: readonly string[];
  certified: boolean;
  enabled: boolean;
}

export interface KernelExecutionState {
  status: AgentRunStatus;
  completedSideEffectKeys: readonly string[];
  checkpointStepId?: string;
}

export interface KernelExecutionPort {
  start(execution: ResolvedKernelExecution): Promise<KernelExecutionState>;
  resume(state: KernelExecutionState): Promise<KernelExecutionState>;
  checkpoint(
    state: KernelExecutionState,
    input: { stepId: string; completedSideEffectKeys?: readonly string[] },
  ): Promise<KernelExecutionState>;
  pause(state: KernelExecutionState, reason: string): Promise<KernelExecutionState>;
  complete(state: KernelExecutionState, result: unknown): Promise<KernelExecutionState>;
  stop(state: KernelExecutionState, status: AgentRunStatus, reason: string): Promise<KernelExecutionState>;
  fail(state: KernelExecutionState, error: unknown): Promise<KernelExecutionState>;
}

export interface KernelRuntimeUsageDelta {
  tokens: number;
  costCents: number;
  latencyMs: number;
}

export type KernelRuntimeStep =
  | {
      kind: "final";
      output: unknown;
      progressFingerprint: string;
      usage: KernelRuntimeUsageDelta;
    }
  | {
      kind: "tool_call";
      stepId: string;
      toolId: string;
      args: unknown;
      businessTarget: unknown;
      progressFingerprint: string;
      usage: KernelRuntimeUsageDelta;
    };

export interface KernelRuntimePort {
  step(input: {
    execution: ResolvedKernelExecution;
    context: KernelContextBundle;
    skills: KernelSkillBundle;
    tools: KernelToolBundle;
    model: KernelModelCandidate;
    usage: AgentLoopUsage;
    previousToolResult?: unknown;
  }): Promise<KernelRuntimeStep>;
}

export type KernelToolGatewayResult =
  | { kind: "executed"; result: unknown }
  | { kind: "denied"; reason: string }
  | { kind: "approval_required"; reason: string; approvalId: string };

export interface KernelToolGatewayPort {
  execute(input: {
    execution: ResolvedKernelExecution;
    tool: KernelToolDefinition;
    args: unknown;
    idempotencyKey: string;
  }): Promise<KernelToolGatewayResult>;
}

export interface KernelVerificationPort {
  verify(input: {
    execution: ResolvedKernelExecution;
    output: unknown;
  }): Promise<{ passed: boolean; evidence: string }>;
}

export interface KernelEvidencePort {
  record(entry: {
    runId: string;
    traceId: string;
    kind: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
}

export interface KernelMemoryPort {
  write(input: { execution: ResolvedKernelExecution; value: unknown }): Promise<void>;
}

export interface KernelEventPort {
  emit(input: { execution: ResolvedKernelExecution; type: string; payload: unknown }): Promise<void>;
}

export interface AgentKernelDependencies {
  resolveAgent(input: AgentKernelInput): Promise<ResolvedKernelAgent | null>;
  createIdentity(input: AgentKernelInput, agent: ResolvedKernelAgent): Promise<ResolvedKernelExecution>;
  loadContext(execution: ResolvedKernelExecution): Promise<KernelContextBundle>;
  loadSkills(execution: ResolvedKernelExecution, context: KernelContextBundle): Promise<KernelSkillBundle>;
  resolveTools(execution: ResolvedKernelExecution, skills: KernelSkillBundle): Promise<KernelToolBundle>;
  selectModel(execution: ResolvedKernelExecution): Promise<KernelModelCandidate | null>;
  runtime: KernelRuntimePort;
  toolGateway: KernelToolGatewayPort;
  execution: KernelExecutionPort;
  verification: KernelVerificationPort;
  evidence: KernelEvidencePort;
  memory: KernelMemoryPort;
  events: KernelEventPort;
}
