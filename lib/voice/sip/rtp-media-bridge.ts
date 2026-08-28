import dgram from "node:dgram";

export interface RtpMediaAriClient {
  createBridge(): Promise<{ bridgeId: string }>;
  createExternalMedia(input: { appName: string; externalHost: string; format: "ulaw"; direction: "both" }): Promise<{ channelId: string }>;
  addChannels(bridgeId: string, channelIds: string[]): Promise<void>;
  hangup(channelId: string): Promise<void>;
  destroyBridge(bridgeId: string): Promise<void>;
}

export interface RtpMediaSession {
  readonly port: number;
  readonly bridgeId: string;
  readonly externalChannelId: string;
  packets(): AsyncIterable<Buffer>;
  send(packet: Buffer): Promise<void>;
  close(): Promise<void>;
}

export interface AsteriskRtpMediaBridge {
  start(input: { callChannelId: string }): Promise<RtpMediaSession>;
}

function required(value: string, name: string): string {
  if (!value.trim()) throw new Error(`[voice] RTP media bridge ${name} is required`);
  return value.trim();
}

/** Opaque RTP transport. Codec, VAD, STT, TTS and dialogue stay outside this adapter. */
export function createAsteriskRtpMediaBridge(deps: {
  ari: RtpMediaAriClient;
  appName: string;
  advertisedHost: string;
  listenHost?: string;
  listenPort?: number;
}): AsteriskRtpMediaBridge {
  const appName = required(deps.appName, "appName");
  const advertisedHost = required(deps.advertisedHost, "advertisedHost");
  const listenHost = deps.listenHost ?? "0.0.0.0";
  const listenPort = deps.listenPort ?? 0;
  if (!Number.isInteger(listenPort) || listenPort < 0 || listenPort > 65535) {
    throw new Error("[voice] RTP media bridge listenPort must be valid");
  }

  return {
    async start(input) {
      const callChannelId = required(input.callChannelId, "callChannelId");
      const socket = dgram.createSocket("udp4");
      const queue: Buffer[] = [];
      const waiters: Array<(result: IteratorResult<Buffer>) => void> = [];
      let peer: { address: string; port: number } | null = null;
      let closed = false;
      socket.on("message", (packet, remote) => {
        peer = { address: remote.address, port: remote.port };
        const waiter = waiters.shift();
        if (waiter) waiter({ value: Buffer.from(packet), done: false });
        else queue.push(Buffer.from(packet));
      });
      await new Promise<void>((resolve, reject) => {
        socket.once("error", reject);
        socket.bind(listenPort, listenHost, () => { socket.removeListener("error", reject); resolve(); });
      });
      const address = socket.address();
      const port = typeof address === "object" ? address.port : 0;
      if (!port) { socket.close(); throw new Error("[voice] RTP media bridge failed to bind UDP socket"); }

      let bridgeId: string | null = null;
      let externalChannelId: string | null = null;
      try {
        bridgeId = (await deps.ari.createBridge()).bridgeId;
        externalChannelId = (await deps.ari.createExternalMedia({ appName, externalHost: `${advertisedHost}:${port}`, format: "ulaw", direction: "both" })).channelId;
        await deps.ari.addChannels(bridgeId, [callChannelId, externalChannelId]);
      } catch (error) {
        socket.close();
        if (externalChannelId) await deps.ari.hangup(externalChannelId).catch(() => undefined);
        if (bridgeId) await deps.ari.destroyBridge(bridgeId).catch(() => undefined);
        throw error;
      }
      return {
        port,
        bridgeId,
        externalChannelId,
        packets() {
          return { [Symbol.asyncIterator]() { return { next: () => {
            if (queue.length) return Promise.resolve({ value: queue.shift()!, done: false });
            if (closed) return Promise.resolve({ value: undefined, done: true });
            return new Promise<IteratorResult<Buffer>>((resolve) => waiters.push(resolve));
          } }; } };
        },
        async send(packet) {
          if (closed) throw new Error("[voice] RTP media session is closed");
          if (!Buffer.isBuffer(packet) || packet.length === 0) throw new Error("[voice] RTP packet must be non-empty");
          if (!peer) throw new Error("[voice] RTP peer is unknown until first inbound packet");
          await new Promise<void>((resolve, reject) => socket.send(packet, peer!.port, peer!.address, (error) => error ? reject(error) : resolve()));
        },
        async close() {
          if (closed) return;
          closed = true;
          while (waiters.length) waiters.shift()!({ value: undefined, done: true });
          await new Promise<void>((resolve) => socket.close(() => resolve()));
          await deps.ari.hangup(externalChannelId!);
          await deps.ari.destroyBridge(bridgeId!);
        },
      };
    },
  };
}
