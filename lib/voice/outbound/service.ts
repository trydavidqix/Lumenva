export type OutboundOpeningResult =
  | { kind: "reply"; text: string }
  | { kind: "blocked"; reason: string };

export interface GovernedVoiceOutboundDeps {
  resolveContactPhone(organizationId: string, contactId: string): Promise<string | null>;
  resolveWorker(organizationId: string): Promise<{ endpoint: string; phoneE164: string } | null>;
  createCall(input: {
    organizationId: string;
    contactId: string;
    agentId: string;
    fromE164: string;
    toE164: string;
  }): Promise<string>;
  generateOpening(input: {
    organizationId: string;
    contactId: string;
    voiceCallId: string;
    agentId: string;
    goal: string;
  }): Promise<OutboundOpeningResult>;
  dial(input: {
    endpoint: string;
    voiceCallId: string;
    toE164: string;
    firstMessage: string;
  }): Promise<void>;
  markFailed(organizationId: string, voiceCallId: string, reason: string): Promise<void>;
}

export type GovernedVoiceOutboundResult =
  | { kind: "accepted"; voiceCallId: string }
  | { kind: "blocked"; reason: string; voiceCallId?: string };

export function createGovernedVoiceOutboundService(deps: GovernedVoiceOutboundDeps) {
  return {
    async initiate(input: {
      organizationId: string;
      contactId: string;
      agentId: string;
      goal: string;
    }): Promise<GovernedVoiceOutboundResult> {
      const toE164 = await deps.resolveContactPhone(input.organizationId, input.contactId);
      if (toE164 === null) return { kind: "blocked", reason: "contact_phone_missing" };
      if (!/^\+[1-9]\d{6,14}$/.test(toE164)) return { kind: "blocked", reason: "contact_phone_invalid" };

      const worker = await deps.resolveWorker(input.organizationId);
      if (worker === null) return { kind: "blocked", reason: "voice_worker_unavailable" };
      if (!/^\+[1-9]\d{6,14}$/.test(worker.phoneE164)) return { kind: "blocked", reason: "voice_worker_source_invalid" };

      const voiceCallId = await deps.createCall({
        organizationId: input.organizationId,
        contactId: input.contactId,
        agentId: input.agentId,
        fromE164: worker.phoneE164,
        toE164,
      });

      const opening = await deps.generateOpening({
        organizationId: input.organizationId,
        contactId: input.contactId,
        voiceCallId,
        agentId: input.agentId,
        goal: input.goal,
      });
      if (opening.kind === "blocked") {
        await deps.markFailed(input.organizationId, voiceCallId, opening.reason);
        return { kind: "blocked", reason: opening.reason, voiceCallId };
      }

      const firstMessage = opening.text.trim();
      if (!firstMessage) {
        await deps.markFailed(input.organizationId, voiceCallId, "voice_opening_empty");
        return { kind: "blocked", reason: "voice_opening_empty", voiceCallId };
      }

      try {
        await deps.dial({ endpoint: worker.endpoint, voiceCallId, toE164, firstMessage });
      } catch {
        await deps.markFailed(input.organizationId, voiceCallId, "voice_worker_dial_failed");
        return { kind: "blocked", reason: "voice_worker_dial_failed", voiceCallId };
      }

      return { kind: "accepted", voiceCallId };
    },
  };
}
