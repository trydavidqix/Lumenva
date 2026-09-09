// @vitest-environment node
import dgram from "node:dgram";
import { afterEach, describe, expect, it } from "vitest";
import { createAsteriskRtpMediaBridge, type RtpMediaAriClient } from "./rtp-media-bridge";

describe("Asterisk RTP media bridge", () => {
  const sockets: dgram.Socket[] = [];
  afterEach(() => { for (const socket of sockets) socket.close(); sockets.length = 0; });
  it("exposes bidirectional RTP packets through one external-media channel", async () => {
    const calls: string[] = [];
    const ari: RtpMediaAriClient = {
      async createBridge() { calls.push("createBridge"); return { bridgeId: "bridge-1" }; },
      async createExternalMedia(input) { calls.push(`external:${input.externalHost}:${input.format}:${input.direction}`); return { channelId: "external-1" }; },
      async addChannels(bridgeId, channelIds) { calls.push(`add:${bridgeId}:${channelIds.join(",")}`); },
      async hangup(channelId) { calls.push(`hangup:${channelId}`); },
      async destroyBridge(bridgeId) { calls.push(`destroy:${bridgeId}`); },
    };
    const session = await createAsteriskRtpMediaBridge({ ari, appName: "voicecore", advertisedHost: "127.0.0.1" }).start({ callChannelId: "call-1" });
    expect(session.port).toBeGreaterThan(0);
    expect(calls).toEqual(["createBridge", `external:127.0.0.1:${session.port}:ulaw:both`, "add:bridge-1:call-1,external-1"]);
    const sender = dgram.createSocket("udp4"); sockets.push(sender);
    await new Promise<void>((resolve) => sender.bind(0, "127.0.0.1", resolve));
    const inbound = Buffer.from([0x80, 0x00, 0x00, 0x01, 0xaa]);
    sender.send(inbound, session.port, "127.0.0.1");
    await expect(session.packets()[Symbol.asyncIterator]().next()).resolves.toMatchObject({ done: false, value: inbound });
    const outbound = Buffer.from([0x80, 0x00, 0x00, 0x02, 0xcc]);
    const received = new Promise<Buffer>((resolve) => sender.once("message", (packet) => resolve(packet)));
    await session.send(outbound);
    await expect(received).resolves.toEqual(outbound);
    await session.close();
    expect(calls.slice(-2)).toEqual(["hangup:external-1", "destroy:bridge-1"]);
  });
});
