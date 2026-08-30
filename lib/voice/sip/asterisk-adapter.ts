import type {
  NormalizedSipCallEvent,
  SipGateway,
  SipOutboundRequest,
  SipOutboundResult,
} from "./gateway";

/**
 * Resolves a verified SIP/BYOC connection + number to an organization.
 * Backed by `createVoiceOrganizationResolver(...).resolveByConnection` —
 * kept as a narrow interface here so this adapter never depends on the DB
 * client directly.
 */
export interface AsteriskConnectionDirectory {
  resolveOrganizationByConnection(externalConnectionId: string, calledE164: string): Promise<string | null>;
}

export interface AriOriginateResult {
  channelId: string;
}

/** Seam around the Asterisk ARI HTTP client. Nothing outside this file talks ARI wire format. */
export interface AriClient {
  originate(input: { endpoint: string; callerId: string; context: string }): Promise<AriOriginateResult>;
}

interface AriChannelCallerOrConnected {
  number?: unknown;
}

interface AriChannel {
  id?: unknown;
  caller?: AriChannelCallerOrConnected;
  connected?: AriChannelCallerOrConnected;
  channelvars?: Record<string, unknown>;
}

interface AriLifecycleEvent {
  type?: unknown;
  timestamp?: unknown;
  channel?: AriChannel;
}

/**
 * The three ARI event types this gateway understands. `StasisStart` is a new
 * inbound leg; `StasisEnd`/`ChannelHangupRequest` both signal call
 * termination (Asterisk can emit either depending on who hangs up and when)
 * — the Voice Core's call-state machine (not this file) decides what a
 * termination event means for an already-known call. Any other event type
 * stays rejected as unsupported, same as before.
 */
const SUPPORTED_ARI_EVENT_TYPES = ["StasisStart", "StasisEnd", "ChannelHangupRequest"] as const;
type SupportedAriEventType = (typeof SUPPORTED_ARI_EVENT_TYPES)[number];

function isSupportedAriEventType(value: unknown): value is SupportedAriEventType {
  return typeof value === "string" && (SUPPORTED_ARI_EVENT_TYPES as readonly string[]).includes(value);
}

function normalizeE164(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`[voice] Asterisk ${field} must be E.164`);
  const normalized = value.trim();
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error(`[voice] Asterisk ${field} must be E.164`);
  return normalized;
}

function requireConnectionId(channel: AriChannel | undefined): string {
  const raw = channel?.channelvars?.["SIP_CONNECTION_ID"];
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("[voice] Asterisk channel is missing SIP_CONNECTION_ID — connection unknown, rejecting");
  }
  return raw.trim();
}

/**
 * First SIP/BYOC gateway (Fase 2 do plano open-source). Speaks Asterisk ARI
 * `StasisStart` (new inbound leg), `StasisEnd`/`ChannelHangupRequest` (call
 * termination) events, and originates outbound calls over a verified
 * customer connection — no purchased technical number involved.
 */
export function createAsteriskSipGateway(deps: {
  directory: AsteriskConnectionDirectory;
  ariClient: AriClient;
  outboundContext: string;
}): SipGateway {
  if (!deps.outboundContext.trim()) throw new Error("[voice] Asterisk outboundContext is required");

  return {
    gateway: "asterisk",

    async parseInboundEvent(rawBody): Promise<NormalizedSipCallEvent> {
      let event: AriLifecycleEvent;
      try {
        event = JSON.parse(rawBody) as AriLifecycleEvent;
      } catch {
        throw new Error("[voice] invalid Asterisk ARI JSON");
      }
      if (!isSupportedAriEventType(event.type)) throw new Error("[voice] unsupported Asterisk ARI event type");
      const eventType = event.type;
      if (typeof event.timestamp !== "string" || !event.timestamp.trim()) {
        throw new Error("[voice] invalid Asterisk ARI event envelope");
      }

      const channel = event.channel;
      const channelId = typeof channel?.id === "string" && channel.id.trim() ? channel.id.trim() : null;
      if (!channelId) throw new Error("[voice] invalid Asterisk ARI channel");

      // Critical isolation rule, same as the Telnyx adapter: identify the
      // tenant from the verified SIP connection first. Caller identity is
      // never searched globally across tenants.
      const connectionId = requireConnectionId(channel);
      const callerE164 = normalizeE164(channel?.caller?.number, "caller number");
      const calledE164 = normalizeE164(channel?.connected?.number, "called number");

      const organizationId = await deps.directory.resolveOrganizationByConnection(connectionId, calledE164);
      if (!organizationId) throw new Error("[voice] organization not found for Asterisk SIP connection");

      return {
        organizationId,
        connectionId,
        gateway: "asterisk",
        providerEventId: channelId,
        eventType,
        // Asterisk ARI timestamps use "+0000" (no colon), which Zod's strict
        // `.datetime()` rejects (only accepts "Z" or "+00:00"). Normalize at
        // the boundary so every consumer gets the repo's canonical ISO-8601
        // UTC contract, not Asterisk's raw offset format.
        occurredAt: new Date(event.timestamp).toISOString(),
        direction: "inbound",
        callerE164,
        calledE164,
        attributes: { callControlId: channelId, callSessionId: null },
      };
    },

    async initiateOutboundCall(request: SipOutboundRequest): Promise<SipOutboundResult> {
      if (!request.organizationId.trim()) throw new Error("[voice] outbound call requires an organization");
      if (!request.contactId.trim()) throw new Error("[voice] outbound call requires a contact");
      if (!request.agentId.trim()) throw new Error("[voice] outbound call requires an agent");
      if (!request.goal.trim()) throw new Error("[voice] outbound call requires a goal");
      if (!request.connectionId.trim()) throw new Error("[voice] outbound call requires a verified connection");

      // The Caller ID must be the customer's own number, and that number
      // must actually belong to their organization under this connection —
      // never an arbitrary number supplied by the caller.
      const ownerOrganizationId = await deps.directory.resolveOrganizationByConnection(
        request.connectionId,
        request.fromE164,
      );
      if (!ownerOrganizationId) {
        throw new Error("[voice] outbound Caller ID does not belong to a verified SIP connection");
      }
      if (ownerOrganizationId !== request.organizationId) {
        throw new Error("[voice] outbound Caller ID belongs to a different organization");
      }

      const result = await deps.ariClient.originate({
        endpoint: `PJSIP/${request.toE164}@${request.connectionId}`,
        callerId: request.fromE164,
        context: deps.outboundContext,
      });
      return { providerCallId: result.channelId };
    },
  };
}
