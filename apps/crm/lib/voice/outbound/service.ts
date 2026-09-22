export type OutboundOpeningResult =
  | { kind: "reply"; text: string }
  | { kind: "blocked"; reason: string };

export type VoiceOutboundProvider = "telnyx" | "asterisk";

export interface VoiceOutboundRoute {
  provider: VoiceOutboundProvider;
  endpoint: string;
  phoneE164: string;
  connectionId: string | null;
}

export interface GovernedVoiceOutboundDeps {
  resolveContactPhone(organizationId: string, contactId: string): Promise<string | null>;
  resolveRoute(organizationId: string): Promise<VoiceOutboundRoute | null>;
  createCall(input: {
    organizationId: string;
    contactId: string;
    agentId: string;
    fromE164: string;
    toE164: string;
    provider: VoiceOutboundProvider;
  }): Promise<string>;
  generateOpening(input: {
    organizationId: string;
    contactId: string;
    voiceCallId: string;
    agentId: string;
    goal: string;
  }): Promise<OutboundOpeningResult>;
  dial(input: {
    route: VoiceOutboundRoute;
    organizationId: string;
    contactId: string;
    agentId: string;
    goal: string;
    voiceCallId: string;
    toE164: string;
    firstMessage: string;
  }): Promise<void>;
  markFailed(
    organizationId: string,
    voiceCallId: string,
    provider: VoiceOutboundProvider,
    reason: string,
  ): Promise<void>;
}

export type GovernedVoiceOutboundResult =
  | { kind: "accepted"; voiceCallId: string; provider: VoiceOutboundProvider }
  | { kind: "blocked"; reason: string; voiceCallId?: string };

const E164 = /^\+[1-9]\d{6,14}$/;

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
      if (!E164.test(toE164)) return { kind: "blocked", reason: "contact_phone_invalid" };

      const route = await deps.resolveRoute(input.organizationId);
      if (route === null) return { kind: "blocked", reason: "voice_route_unavailable" };
      if (!E164.test(route.phoneE164)) return { kind: "blocked", reason: "voice_route_source_invalid" };
      if (!/^https:\/\//.test(route.endpoint)) return { kind: "blocked", reason: "voice_route_endpoint_invalid" };
      if (route.provider === "asterisk" && !route.connectionId?.trim()) {
        return { kind: "blocked", reason: "voice_route_connection_missing" };
      }

      const voiceCallId = await deps.createCall({
        organizationId: input.organizationId,
        contactId: input.contactId,
        agentId: input.agentId,
        fromE164: route.phoneE164,
        toE164,
        provider: route.provider,
      });

      const opening = await deps.generateOpening({
        organizationId: input.organizationId,
        contactId: input.contactId,
        voiceCallId,
        agentId: input.agentId,
        goal: input.goal,
      });
      if (opening.kind === "blocked") {
        await deps.markFailed(input.organizationId, voiceCallId, route.provider, opening.reason);
        return { kind: "blocked", reason: opening.reason, voiceCallId };
      }

      const firstMessage = opening.text.trim();
      if (!firstMessage) {
        await deps.markFailed(input.organizationId, voiceCallId, route.provider, "voice_opening_empty");
        return { kind: "blocked", reason: "voice_opening_empty", voiceCallId };
      }

      try {
        await deps.dial({
          route,
          organizationId: input.organizationId,
          contactId: input.contactId,
          agentId: input.agentId,
          goal: input.goal,
          voiceCallId,
          toE164,
          firstMessage,
        });
      } catch {
        await deps.markFailed(input.organizationId, voiceCallId, route.provider, "voice_worker_dial_failed");
        return { kind: "blocked", reason: "voice_worker_dial_failed", voiceCallId };
      }

      return { kind: "accepted", voiceCallId, provider: route.provider };
    },
  };
}
