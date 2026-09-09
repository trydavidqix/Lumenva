import type { AsteriskListenerResult } from "./asterisk-listener";
import type { SipBrainClient, SipEventRequest } from "./brain-client";

/**
 * The last piece of the loop: turns a `normalized` `AsteriskListenerResult`
 * (from `asterisk-listener.ts`) into real HTTP calls against
 * `app/api/internal/voice/context` (idempotent — same `provider_call_id`
 * always resolves the same `voice_call_id`, so calling it on every event is
 * safe, not just on the first one) and `app/api/internal/voice/event`
 * (records the lifecycle transition). `rejected` results are never
 * forwarded — there is nothing valid to persist for an event the gateway
 * itself couldn't parse or authorize.
 *
 * Deliberately stateless: no local cache of channelId -> voiceCallId. The
 * Telnyx worker (`workers/voice-worker/call-context.mjs`) keeps one because
 * Patter's event shape needs it to survive between calls in the same
 * process; this forwarder re-resolves via `/context` every time instead,
 * trading one extra idempotent round-trip for zero local state to get
 * wrong. Revisit only if this becomes a measured hot path.
 */
function stateForEventType(eventType: string): SipEventRequest["state"] | null {
  if (eventType === "StasisStart") return "active";
  if (eventType === "StasisEnd" || eventType === "ChannelHangupRequest") return "completed";
  return null;
}

export interface SipEventForwarder {
  forward(result: AsteriskListenerResult): Promise<void>;
}

export function createSipEventForwarder(deps: { brainClient: SipBrainClient }): SipEventForwarder {
  return {
    async forward(result): Promise<void> {
      if (result.status !== "normalized") return;
      const { event } = result;

      const state = stateForEventType(event.eventType);
      // Defensive: the gateway's own allow-list (StasisStart/StasisEnd/
      // ChannelHangupRequest) already guarantees this, but never guess a
      // lifecycle state for an event type this forwarder doesn't know.
      if (!state) return;

      const technicalE164 = event.direction === "inbound" ? event.calledE164 : event.callerE164;

      const context = await deps.brainClient.resolveContext({
        provider_call_id: event.providerEventId,
        connection_id: event.connectionId,
        caller_e164: event.callerE164,
        called_e164: event.calledE164,
        direction: event.direction,
      });

      await deps.brainClient.recordEvent({
        voice_call_id: context.voice_call_id,
        connection_id: event.connectionId,
        phone_e164: technicalE164,
        state,
        // Same convention as the Telnyx worker's `${callId}:${state}` —
        // provider_event_id must be unique per lifecycle occurrence, not
        // just per channel, so StasisStart and StasisEnd on the same
        // channel don't collide on /event's idempotency key.
        provider_event_id: `${event.providerEventId}:${event.eventType}`,
        provider_call_id: event.providerEventId,
        occurred_at: event.occurredAt,
      });
    },
  };
}
