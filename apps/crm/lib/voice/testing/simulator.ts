export interface VoiceSimulationContext {
  voiceCallId: string;
  organizationId: string;
  contactId: string | null;
  callerKind: "known" | "unknown";
  locale: string;
}

export interface VoiceSimulationDeps {
  resolveContext(input: {
    providerCallId: string;
    callerE164: string;
    calledE164: string;
    direction: "inbound";
  }): Promise<VoiceSimulationContext>;
  runTurn(input: {
    organizationId: string;
    contactId: string | null;
    voiceCallId: string;
    transcript: string;
  }): Promise<{ kind: "reply"; text: string } | { kind: "blocked"; reason: string }>;
  recordEvent(input: {
    voiceCallId: string;
    state: "active" | "completed" | "failed";
    providerEventId: string;
    occurredAt: string;
    reason?: string;
  }): Promise<void>;
}

export function createVoiceE2ESimulator(deps: VoiceSimulationDeps) {
  return {
    async run(input: {
      providerCallId: string;
      callerE164: string;
      calledE164: string;
      transcripts: readonly string[];
    }): Promise<{ replies: string[]; blockedReason?: string }> {
      const context = await deps.resolveContext({
        providerCallId: input.providerCallId,
        callerE164: input.callerE164,
        calledE164: input.calledE164,
        direction: "inbound",
      });
      const now = () => new Date().toISOString();
      await deps.recordEvent({
        voiceCallId: context.voiceCallId,
        state: "active",
        providerEventId: `${input.providerCallId}:sim:active`,
        occurredAt: now(),
      });

      const replies: string[] = [];
      for (const rawTranscript of input.transcripts) {
        const transcript = rawTranscript.trim();
        if (!transcript) continue;
        const turn = await deps.runTurn({
          organizationId: context.organizationId,
          contactId: context.contactId,
          voiceCallId: context.voiceCallId,
          transcript,
        });
        if (turn.kind === "blocked") {
          await deps.recordEvent({
            voiceCallId: context.voiceCallId,
            state: "failed",
            providerEventId: `${input.providerCallId}:sim:blocked`,
            occurredAt: now(),
            reason: turn.reason,
          });
          return { replies, blockedReason: turn.reason };
        }
        replies.push(turn.text);
      }

      await deps.recordEvent({
        voiceCallId: context.voiceCallId,
        state: "completed",
        providerEventId: `${input.providerCallId}:sim:completed`,
        occurredAt: now(),
      });
      return { replies };
    },
  };
}
