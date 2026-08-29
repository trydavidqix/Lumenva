import type { VoiceCallerResolution } from "../identity/resolve-caller";

export interface VoiceCallContextRequest {
  providerCallId: string;
  callerE164: string;
  calledE164: string;
  direction: "inbound" | "outbound";
}

export function createVoiceCallContextService(deps: {
  resolveOrganization(provider: "telnyx", technicalE164: string): Promise<string | null>;
  resolveCaller(organizationId: string, customerE164: string): Promise<VoiceCallerResolution>;
  persistCall(input: {
    organizationId: string;
    contactId: string | null;
    providerCallId: string;
    callerE164: string;
    calledE164: string;
    direction: "inbound" | "outbound";
  }): Promise<string>;
  loadConfig(organizationId: string): Promise<{ locale: string }>;
}) {
  return {
    async resolve(input: VoiceCallContextRequest) {
      const technicalE164 = input.direction === "inbound" ? input.calledE164 : input.callerE164;
      const customerE164 = input.direction === "inbound" ? input.callerE164 : input.calledE164;
      const organizationId = await deps.resolveOrganization("telnyx", technicalE164);
      if (organizationId === null) throw new Error("[voice] technical number is not owned by an enabled tenant");

      const caller = await deps.resolveCaller(organizationId, customerE164);
      const voiceCallId = await deps.persistCall({
        organizationId,
        contactId: caller.contactId,
        providerCallId: input.providerCallId,
        callerE164: input.callerE164,
        calledE164: input.calledE164,
        direction: input.direction,
      });
      const config = await deps.loadConfig(organizationId);
      return {
        voiceCallId,
        organizationId,
        contactId: caller.contactId,
        callerKind: caller.kind,
        locale: config.locale,
      } as const;
    },
  };
}
