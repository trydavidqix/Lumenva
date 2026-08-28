import type { SipGateway, NormalizedSipCallEvent } from "./gateway";
import type { AriConnection } from "./asterisk-ari-client";

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

export async function createAsteriskAriListener(deps: {
  connection: AriConnection;
  gateway: SipGateway;
  appName: string;
}): Promise<AsteriskAriListener> {
  const stream = await deps.connection.connectEvents(deps.appName);

  return {
    events(): AsyncIterable<AsteriskListenerResult> {
      return {
        async *[Symbol.asyncIterator]() {
          for await (const raw of stream.events()) {
            try {
              const event = await deps.gateway.parseInboundEvent(JSON.stringify(raw));
              yield { status: "normalized", event };
            } catch (error) {
              yield { status: "rejected", error: error instanceof Error ? error : new Error(String(error)), raw };
            }
          }
        },
      };
    },
    close(): Promise<void> {
      return stream.close();
    },
  };
}
