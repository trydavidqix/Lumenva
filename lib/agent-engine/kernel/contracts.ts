import type { AgentDefinition, AgentRunIdentity, AgentRunStatus } from "../contracts/agent-os";

export interface AgentKernelTrigger {
  kind: string;
  sourceId: string;
  eventId?: string;
  jobId?: string;
}

export interface AgentKernelInput {
  organizationId: string;
  agentId: string;
  goal: string;
  trigger: AgentKernelTrigger;
  runId?: string;
  traceId?: string;
  correlationId?: string;
  resume?: boolean;
}

export interface AgentKernelResult {
  status: AgentRunStatus;
  stopReason: string;
  runId: string;
  traceId: string;
  correlationId: string;
  approvalId?: string;
  output?: unknown;
}

export interface AgentKernel {
  run(input: AgentKernelInput): Promise<AgentKernelResult>;
}

export interface ResolvedKernelAgent {
  organizationId: string;
  enabled: boolean;
  definition: AgentDefinition;
}

export interface ResolvedKernelExecution extends AgentRunIdentity {
  goal: string;
  trigger: AgentKernelTrigger;
  definition: AgentDefinition;
  resume: boolean;
}
