import type { SipGateway, NormalizedSipCallEvent } from "./gateway";
import type { AriConnection, AriEventStream } from "./asterisk-ari-client";

/**
 * Consumes the real ARI event stream and feeds each event through the
 * SipGateway's own validation/tenant-isolation path
 * (`parseInboundEvent`) — this file adds no new tenant/business logic of
 * its own. A real Asterisk sends event types this gateway doesn't
 * recognize (`ChannelStateChange`, `ChannelVarset`, etc.) constantly; one
 * unsupported or rejected event must never take down the listener, so
 * every event resolves to a tagged result instead of throwing out of the
 * iterator.
 */
export type AsteriskListenerResult =
  | { status: "normalized"; event: NormalizedSipCallEvent }
  | { status: "rejected"; error: Error; raw: unknown };

export interface AsteriskAriListener {
  events(): AsyncIterable<AsteriskListenerResult>;
  close(): Promise<void>;
}

export interface AsteriskAriListenerDeps {
  connection: AriConnection;
  gateway: SipGateway;
  appName: string;
  /** Delay before the first reconnect attempt, ms. Defaults to 1000. */
  reconnectDelayMs?: number;
  /** Cap for exponential backoff between reconnect attempts, ms. Defaults to 30000. */
  maxReconnectDelayMs?: number;
  /** Injectable for tests; defaults to a real setTimeout-based delay. */
  wait?: (ms: number) => Promise<void>;
}

const defaultWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const LIFECYCLE_EVENTS = new Set(["StasisStart", "StasisEnd", "ChannelHangupRequest"]);

interface CachedLifecycleVars {
  connectionId: string;
  direction?: "outbound";
  voiceCallId?: string;
}

async function hydrateLifecycleVariables(
  connection: AriConnection,
  raw: unknown,
  cache: Map<string, CachedLifecycleVars>,
): Promise<unknown> {
  if (!raw || typeof raw !== "object") return raw;
  const event = raw as { type?: unknown; channel?: { id?: unknown; channelvars?: Record<string, unknown> } };
  if (!LIFECYCLE_EVENTS.has(String(event.type))) return raw;
  const channel = event.channel;
  if (!channel || typeof channel.id !== "string" || !channel.id.trim()) return raw;

  const cached = cache.get(channel.id);
  const channelvars = { ...(channel.channelvars ?? {}) };

  let connectionId =
    typeof channelvars.SIP_CONNECTION_ID === "string" && channelvars.SIP_CONNECTION_ID.trim()
      ? channelvars.SIP_CONNECTION_ID.trim()
      : cached?.connectionId ?? null;

  if (!connectionId) {
    try {
      connectionId = await connection.getChannelVariable(channel.id, "SIP_CONNECTION_ID");
    } catch (error) {
      if (!cached?.connectionId) throw error;
      connectionId = cached.connectionId;
    }
  }
  if (!connectionId) return raw;
  channelvars.SIP_CONNECTION_ID = connectionId;

  // These variables exist only for governed outbound calls. They are
  // optional for inbound traffic, so a 404 while hydrating them must never
  // reject an otherwise valid inbound event.
  let direction: "outbound" | undefined =
    channelvars.VOICE_DIRECTION === "outbound" || cached?.direction === "outbound"
      ? "outbound"
      : undefined;
  let voiceCallId =
    typeof channelvars.VOICE_CALL_ID === "string" && channelvars.VOICE_CALL_ID.trim()
      ? channelvars.VOICE_CALL_ID.trim()
      : cached?.voiceCallId;

  if (!direction) {
    try {
      const value = await connection.getChannelVariable(channel.id, "VOICE_DIRECTION");
      if (value === "outbound") direction = "outbound";
    } catch {
      // Optional variable: inbound calls legitimately do not have it.
    }
  }
  if (!voiceCallId) {
    try {
      const value = await connection.getChannelVariable(channel.id, "VOICE_CALL_ID");
      if (value?.trim()) voiceCallId = value.trim();
    } catch {
      // Optional variable: inbound calls legitimately do not have it.
    }
  }

  if (direction) channelvars.VOICE_DIRECTION = direction;
  if (voiceCallId) channelvars.VOICE_CALL_ID = voiceCallId;
  cache.set(channel.id, { connectionId, ...(direction ? { direction } : {}), ...(voiceCallId ? { voiceCallId } : {}) });

  return { ...event, channel: { ...channel, channelvars } };
}

export async function createAsteriskAriListener(deps: AsteriskAriListenerDeps): Promise<AsteriskAriListener> {
  const wait = deps.wait ?? defaultWait;
  const reconnectDelayMs = deps.reconnectDelayMs ?? 1_000;
  const maxReconnectDelayMs = deps.maxReconnectDelayMs ?? 30_000;

  let stream: AriEventStream = await deps.connection.connectEvents(deps.appName);
  let explicitlyClosed = false;
  const cachedLifecycleVars = new Map<string, CachedLifecycleVars>();

  // Reconnects with exponential backoff whenever the stream ends without
  // `close()` having been called — a dropped WebSocket must not be
  // permanent silence for the rest of the process's life. There is no
  // retry cap: an unreachable Asterisk is a condition to keep retrying
  // against, not to give up on.
  async function reconnectWithBackoff(): Promise<AriEventStream> {
    let delay = reconnectDelayMs;
    for (;;) {
      await wait(delay);
      if (explicitlyClosed) throw new Error("[voice] Asterisk ARI listener was closed during reconnect");
      try {
        return await deps.connection.connectEvents(deps.appName);
      } catch {
        delay = Math.min(delay * 2, maxReconnectDelayMs);
      }
    }
  }

  return {
    events(): AsyncIterable<AsteriskListenerResult> {
      return {
        async *[Symbol.asyncIterator]() {
          while (!explicitlyClosed) {
            for await (const raw of stream.events()) {
              try {
                const hydrated = await hydrateLifecycleVariables(deps.connection, raw, cachedLifecycleVars);
                const event = await deps.gateway.parseInboundEvent(JSON.stringify(hydrated));
                if (event.eventType === "StasisEnd" || event.eventType === "ChannelHangupRequest") {
                  cachedLifecycleVars.delete(event.providerEventId);
                }
                yield { status: "normalized", event };
              } catch (error) {
                yield { status: "rejected", error: error instanceof Error ? error : new Error(String(error)), raw };
              }
            }
            if (explicitlyClosed) return;
            // The stream ended without an explicit close() — an
            // unexpected drop (server restart, network blip). Reconnect
            // and keep going; some events during the gap are
            // unavoidably lost, same as any at-least-once telephony
            // signaling channel.
            stream = await reconnectWithBackoff();
          }
        },
      };
    },
    async close(): Promise<void> {
      explicitlyClosed = true;
      await stream.close();
    },
  };
}
