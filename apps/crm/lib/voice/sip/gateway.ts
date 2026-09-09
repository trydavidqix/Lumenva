export type SipCallDirection = "inbound" | "outbound";

export interface NormalizedSipCallEvent {
  organizationId: string;
  connectionId: string;
  gateway: "asterisk" | "telnyx";
  providerEventId: string;
  eventType: string;
  occurredAt: string;
  direction: SipCallDirection;
  callerE164: string;
  calledE164: string;
  attributes: {
    callControlId: string | null;
    callSessionId: string | null;
  };
}

export interface SipOutboundRequest {
  organizationId: string;
  connectionId: string;
  contactId: string;
  agentId: string;
  goal: string;
  /** The customer's own number — used as Caller ID, never a platform-purchased number. */
  fromE164: string;
  toE164: string;
}

export interface SipOutboundResult {
  providerCallId: string;
}

/**
 * Provider-neutral SIP/BYOC boundary (Fase 2 do plano open-source). An
 * implementation receives inbound calls over a customer-authorized
 * connection and can place outbound calls over that same connection.
 * Nothing outside a specific gateway adapter
 * (lib/voice/sip/<gateway>-adapter.ts) knows the wire format of that
 * carrier/PBX — the rest of the Voice Core only ever sees
 * NormalizedSipCallEvent.
 *
 * Replaces the old "one purchased technical number identifies the tenant"
 * model: identity now resolves conexão SIP -> número E.164 -> organização.
 */
export interface SipGateway {
  readonly gateway: "asterisk" | "telnyx";
  parseInboundEvent(rawBody: string): Promise<NormalizedSipCallEvent>;
  initiateOutboundCall(request: SipOutboundRequest): Promise<SipOutboundResult>;
}
