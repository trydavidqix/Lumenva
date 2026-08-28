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

export async function createAsteriskAriListener(deps: AsteriskAriListenerDeps): Promise<AsteriskAriListener> {
  const wait = deps.wait ?? defaultWait;
  const reconnectDelayMs = deps.reconnectDelayMs ?? 1_000;
  const maxReconnectDelayMs = deps.maxReconnectDelayMs ?? 30_000;

  let stream: AriEventStream = await deps.connection.connectEvents(deps.appName);
  let explicitlyClosed = false;

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
                const event = await deps.gateway.parseInboundEvent(JSON.stringify(raw));
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
