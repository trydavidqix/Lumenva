import { randomUUID } from "node:crypto";
import type pg from "pg";

import { llmEdgeConfigFromEnv, runModelCall } from "../../agent-engine/edge/llm/run-model-call";
import { createAgentKernel } from "../../agent-engine/kernel/agent-kernel";
import type { AgentKernel } from "../../agent-engine/kernel/contracts";
import type { AgentKernelDependencies, KernelExecutionState } from "../../agent-engine/kernel/ports";
import { resolveAgentConversationStyle } from "../../agent-engine/product-agents/conversation-style";
import { getProductAgentDefinition } from "../../agent-engine/product-agents/definitions";
import { createProductAgentVerificationPort } from "../../agent-engine/product-agents/verification";

function outputContract(agentId: string): string {
  switch (agentId) {
    case "supervisor":
      return '{"targetAgent":"atendimento|sales|retention|escalation|crm_operator|governance_judge","reason":"...","confidence":0.0,"requiresHumanEscalation":false}';
    case "atendimento":
      return '{"kind":"draft_response","draft":"customer-safe spoken reply","rationale":"...","needsHumanReview":false}';
    case "sales":
      return '{"kind":"sales_recommendation","qualification":"cold|warm|hot","nextAction":"...","rationale":"...","draftMessage":"customer-safe spoken reply"}';
    case "retention":
      return '{"kind":"retention_recommendation","risk":"low|medium|high","action":"...","rationale":"...","draftMessage":"customer-safe spoken reply"}';
    case "escalation":
      return '{"kind":"human_escalation","reason":"...","priority":"normal|high|urgent","requiredContext":["..."]}';
    default:
      return '{}';
  }
}

function customerFacingVoiceInstructions(agentId: string): string[] {
  if (!["atendimento", "sales", "retention"].includes(agentId)) return [];
  return [
    "For the customer-facing draft/draftMessage only: use one or two short sentences maximum.",
    "Spell every number, date, time, code, and monetary value in words in the customer-facing text; never use digits or currency symbols there.",
    "End the customer-facing text with a direct question or another explicit cue that clearly passes the turn back to the caller.",
    "These voice-format rules never authorize changing facts, prices, dates, policies, permissions, or commitments.",
  ];
}

function parseJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function executionState(status: KernelExecutionState["status"] = "running"): KernelExecutionState {
  return { status, completedSideEffectKeys: [] };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function voiceLlmEnv() {
  return {
    ...(process.env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : {}),
    ...(process.env.OPENAI_API_KEY ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY } : {}),
    ...(process.env.LLM_CACHE_TTL ? { LLM_CACHE_TTL: process.env.LLM_CACHE_TTL } : {}),
  };
}

export function createVoiceProductionKernel(db: pg.Pool): AgentKernel {
  const deps: AgentKernelDependencies = {
    async resolveAgent(input) {
      const definition = getProductAgentDefinition(input.agentId);
      if (definition === null) return null;
      return { organizationId: input.organizationId, enabled: true, definition };
    },
    async createIdentity(input, agent) {
      return {
        runId: input.runId ?? randomUUID(),
        organizationId: input.organizationId,
        agentId: agent.definition.id,
        agentVersion: agent.definition.version,
        traceId: input.traceId ?? randomUUID(),
        correlationId: input.correlationId ?? input.trigger.eventId ?? randomUUID(),
        goal: input.goal,
        trigger: input.trigger,
        definition: agent.definition,
        resume: input.resume ?? false,
      };
    },
    async loadContext(execution) {
      const voiceCallId = execution.trigger.eventId;
      if (!voiceCallId) return { authoritative: {}, derivedMemory: {}, sources: [] };
      const { rows } = await db.query<{ contact_id: string | null; memory: unknown }>(
        `select vc.contact_id, cm.memory
           from voice_calls vc
           left join customer_memory cm
             on cm.organization_id = vc.organization_id and cm.contact_id = vc.contact_id
          where vc.id = $1 and vc.organization_id = $2
          limit 1`,
        [voiceCallId, execution.organizationId],
      );
      const row = rows[0];
      return {
        authoritative: { voiceCallId, contactId: row?.contact_id ?? null },
        derivedMemory: row?.memory && typeof row.memory === "object" ? (row.memory as Record<string, unknown>) : {},
        sources: [`voice_call:${voiceCallId}`],
      };
    },
    async loadSkills() {
      return { activatedSkillVersions: [], index: "", bodies: "", requestedToolIds: [] };
    },
    async resolveTools() {
      return { definitions: new Map() };
    },
    async selectModel(execution) {
      return {
        id: "organization-default",
        provider: "organization-config",
        capabilities: execution.definition.requiredModelCapabilities,
        certified: true,
        enabled: true,
      };
    },
    runtime: {
      async step({ execution, context }) {
        const started = Date.now();
        const sourceId = execution.trigger.sourceId;
        const conversationStyle = resolveAgentConversationStyle(execution.definition);
        const styleExamples = conversationStyle.examplePhrases?.length
          ? conversationStyle.examplePhrases.join(" | ")
          : null;
        const response = await runModelCall(
          db,
          llmEdgeConfigFromEnv(voiceLlmEnv()),
          {
            tenantId: execution.organizationId,
            ...(isUuid(sourceId) ? { leadId: sourceId } : {}),
            // execution.runId é um UUID sintético do kernel de voz, não uma
            // linha real de job_queue — passá-lo como jobId derrubava o
            // INSERT em llm_calls por violação de llm_calls_job_id_fkey.
            purpose: "voice_agent_turn",
            system: [
              `Agent: ${execution.agentId} v${execution.agentVersion}.`,
              `Objective: ${execution.definition.objective}`,
              `Conversation register: ${conversationStyle.register}.`,
              `Conversation style: ${conversationStyle.toneInstructions}`,
              ...(styleExamples ? [`Style examples: ${styleExamples}`] : []),
              "Conversation style affects wording and tone only. It never overrides facts, policies, permissions, output contracts, or tool restrictions.",
              ...customerFacingVoiceInstructions(execution.agentId),
              "Return ONLY one valid JSON object. Do not wrap it in markdown.",
              `Required output contract: ${outputContract(execution.agentId)}`,
              "Treat derived memory as context, never as permission to make irreversible commitments.",
            ].join("\n"),
            messages: [{ role: "user", content: JSON.stringify({ goal: execution.goal, context }) }],
            maxSteps: 1,
          },
          { traceId: execution.traceId, parentRunId: execution.runId },
        );
        const output = parseJsonObject(response.result.text);
        return {
          kind: "final" as const,
          output,
          progressFingerprint: `final:${execution.agentId}:${JSON.stringify(output).slice(0, 160)}`,
          usage: {
            tokens: response.usage.inputTokens + response.usage.outputTokens,
            costCents: response.costCents ?? 0,
            latencyMs: response.latencyMs ?? Date.now() - started,
          },
        };
      },
    },
    toolGateway: { async execute() { return { kind: "denied", reason: "voice_tool_set_not_promoted" }; } },
    execution: {
      async start() { return executionState(); },
      async resume(state) { return state; },
      async checkpoint(state, checkpoint) {
        return { ...state, checkpointStepId: checkpoint.stepId, completedSideEffectKeys: checkpoint.completedSideEffectKeys ?? state.completedSideEffectKeys };
      },
      async pause(state) { return { ...state, status: "waiting_approval" }; },
      async complete(state) { return { ...state, status: "completed" }; },
      async stop(state, status) { return { ...state, status }; },
      async fail(state) { return { ...state, status: "permanent_failure" }; },
    },
    verification: createProductAgentVerificationPort(),
    evidence: { async record() { /* tracing/llm_calls remain authoritative; no fake tenant evidence */ } },
    memory: { async write() { /* writes remain governed by explicit tools */ } },
    events: { async emit() { /* call events are recorded by voice transport */ } },
  };

  return createAgentKernel(deps);
}

export type VoiceProductionKernel = ReturnType<typeof createVoiceProductionKernel>;
