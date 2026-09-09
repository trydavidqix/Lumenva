import type { VoiceEngine, VoiceEngineSession } from "../engine/contracts";
import type { VoiceCallerResolution } from "../identity/resolve-caller";
import type { NormalizedTelnyxCallEvent } from "./webhook";

export interface TelnyxCallerResolver {
  resolve(organizationId: string, customerE164: string): Promise<VoiceCallerResolution>;
}

export function createTelnyxVoiceOrchestrator(deps: {
  callerResolver: TelnyxCallerResolver;
  engine: VoiceEngine;
}) {
  return {
    async start(
      event: NormalizedTelnyxCallEvent,
      voiceCallId: string,
      locale: string,
    ): Promise<{
      session: VoiceEngineSession;
      contactId: string | null;
      callerKind: VoiceCallerResolution["kind"];
    }> {
      if (!event.organizationId.trim()) {
        throw new Error("[voice] Telnyx event must have a resolved organization before engine start");
      }

      // For inbound, the remote caller is the customer. For outbound, the
      // called party is the customer; the caller is our technical Telnyx number.
      const customerE164 = event.direction === "inbound" ? event.callerE164 : event.calledE164;
      const caller = await deps.callerResolver.resolve(event.organizationId, customerE164);

      const session = await deps.engine.startSession({
        organizationId: event.organizationId,
        voiceCallId,
        contactId: caller.contactId,
        direction: event.direction,
        locale,
      });

      return {
        session,
        contactId: caller.contactId,
        callerKind: caller.kind,
      };
    },
  };
}
