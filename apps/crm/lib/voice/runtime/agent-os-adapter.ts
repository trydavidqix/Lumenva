import type { AgentKernel } from "../../agent-engine/kernel/contracts";

export interface VoiceAgentResolutionInput {
  organizationId: string;
  contactId: string;
  voiceCallId: string;
  transcript: string;
}

export type VoiceAgentResolver = (input: VoiceAgentResolutionInput) => Promise<string | null>;
export type VoiceDeliveryChannel = "voice" | "default";
export type VoiceDeliveryAuthorizer = (input: { organizationId: string; agentId: string; channel?: VoiceDeliveryChannel }) => Promise<boolean>;

export type VoiceAgentTurnResult =
  | { kind: "reply"; text: string; agentId: string; runId: string; traceId: string }
  | { kind: "blocked"; reason: string; agentId?: string; runId?: string; traceId?: string; approvalId?: string };

export function extractSpeakableVoiceText(output: unknown): string | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const record = output as Record<string, unknown>;
  for (const key of ["draft", "draftMessage", "text", "message", "reply"] as const) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim() && candidate.trim().length <= 4000) return candidate.trim();
  }
  return null;
}

export function createVoiceAgentOsAdapter(deps: {
  kernel: AgentKernel;
  resolveAgent: VoiceAgentResolver;
  authorizeDelivery: VoiceDeliveryAuthorizer;
}) {
  return {
    async runTurn(input: VoiceAgentResolutionInput): Promise<VoiceAgentTurnResult> {
      const agentId = await deps.resolveAgent(input);
      if (agentId === null) return { kind: "blocked", reason: "voice_agent_unresolved" };

      const result = await deps.kernel.run({
        organizationId: input.organizationId,
        agentId,
        goal: input.transcript,
        trigger: { kind: "voice_turn", sourceId: input.contactId, eventId: input.voiceCallId },
        correlationId: input.voiceCallId,
      });

      if (result.status !== "completed") {
        return {
          kind: "blocked",
          reason: result.stopReason,
          agentId,
          runId: result.runId,
          traceId: result.traceId,
          ...(result.approvalId !== undefined ? { approvalId: result.approvalId } : {}),
        };
      }

      if (!(await deps.authorizeDelivery({ organizationId: input.organizationId, agentId, channel: "voice" }))) {
        return { kind: "blocked", reason: "voice_delivery_not_authorized", agentId, runId: result.runId, traceId: result.traceId };
      }

      const text = extractSpeakableVoiceText(result.output);
      if (text === null) {
        return { kind: "blocked", reason: "voice_agent_output_not_speakable", agentId, runId: result.runId, traceId: result.traceId };
      }

      return { kind: "reply", text, agentId, runId: result.runId, traceId: result.traceId };
    },
  };
}
