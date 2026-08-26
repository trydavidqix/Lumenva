import type { AgentKernel } from "../../agent-engine/kernel/contracts";

export interface VoiceAgentResolutionInput {
  organizationId: string;
  contactId: string;
  voiceCallId: string;
  transcript: string;
}

export type VoiceAgentResolver = (input: VoiceAgentResolutionInput) => Promise<string | null>;

export type VoiceAgentTurnResult =
  | {
      kind: "reply";
      text: string;
      agentId: string;
      runId: string;
      traceId: string;
    }
  | {
      kind: "blocked";
      reason: string;
      agentId?: string;
      runId?: string;
      traceId?: string;
      approvalId?: string;
    };

function extractSpeakableText(output: unknown): string | null {
  if (typeof output === "string") {
    const text = output.trim();
    return text || null;
  }
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const record = output as Record<string, unknown>;
  for (const key of ["draft", "text", "message", "reply"] as const) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function createVoiceAgentOsAdapter(deps: {
  kernel: AgentKernel;
  resolveAgent: VoiceAgentResolver;
}) {
  return {
    async runTurn(input: VoiceAgentResolutionInput): Promise<VoiceAgentTurnResult> {
      const agentId = await deps.resolveAgent(input);
      if (agentId === null) return { kind: "blocked", reason: "voice_agent_unresolved" };

      const result = await deps.kernel.run({
        organizationId: input.organizationId,
        agentId,
        goal: input.transcript,
        trigger: {
          kind: "voice_turn",
          sourceId: input.contactId,
          eventId: input.voiceCallId,
        },
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

      const text = extractSpeakableText(result.output);
      if (text === null) {
        return {
          kind: "blocked",
          reason: "voice_agent_output_not_speakable",
          agentId,
          runId: result.runId,
          traceId: result.traceId,
        };
      }

      return {
        kind: "reply",
        text,
        agentId,
        runId: result.runId,
        traceId: result.traceId,
      };
    },
  };
}
