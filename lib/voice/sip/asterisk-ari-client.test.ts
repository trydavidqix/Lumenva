// @vitest-environment node
//
// The suite's default jsdom environment replaces the global `Event`/`WebSocket`
// with jsdom's own implementations, which fail Node's internal brand checks
// inside its undici-based WebSocket client (ERR_INVALID_ARG_TYPE). This file
// exercises the real Node WebSocket client against a real local server, so it
// needs Node's actual globals, not jsdom's.
import { afterEach, describe, expect, it } from "vitest";
import { createAsteriskAriConnection } from "./asterisk-ari-client";
import { startFakeAriServer, type FakeAriServer } from "./testing/fake-ari-server";

describe("Asterisk ARI concrete client (Fase 3, real wire protocol)", () => {
  let fakeAri: FakeAriServer | null = null;

  afterEach(async () => {
    await fakeAri?.close();
    fakeAri = null;
  });

  it("originates a call and returns the real channel id", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({
      baseUrl: fakeAri.baseUrl,
      username: fakeAri.username,
      password: fakeAri.password,
    });

    const result = await client.originate({
      endpoint: "PJSIP/+351911234567@sip-conn-abc",
      callerId: "+351211234567",
      context: "lumenva-voice",
    });

    expect(result).toEqual({ channelId: "channel-abc" });
    expect(fakeAri.lastRequest?.method).toBe("POST");
    expect(fakeAri.lastRequest?.url).toContain("/ari/channels?");
    expect(fakeAri.lastRequest?.url).toContain("endpoint=PJSIP%2F%2B351911234567%40sip-conn-abc");
  });

  it("throws with the real status and body when Asterisk rejects authentication", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: fakeAri.username, password: "wrong" });

    await expect(
      client.originate({ endpoint: "PJSIP/x@y", callerId: "+351211234567", context: "lumenva-voice" }),
    ).rejects.toThrow(/401/);
  });

  it("throws when Asterisk returns a 5xx originate error", async () => {
    fakeAri = await startFakeAriServer();
    fakeAri.respondNextOriginateWith = { status: 500, body: { message: "internal" } };
    const client = createAsteriskAriConnection({
      baseUrl: fakeAri.baseUrl,
      username: fakeAri.username,
      password: fakeAri.password,
    });

    await expect(
      client.originate({ endpoint: "PJSIP/x@y", callerId: "+351211234567", context: "lumenva-voice" }),
    ).rejects.toThrow(/500/);
  });

  it("answers a channel", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({
      baseUrl: fakeAri.baseUrl,
      username: fakeAri.username,
      password: fakeAri.password,
    });

    await expect(client.answer("channel-abc")).resolves.toBeUndefined();
    expect(fakeAri.lastRequest?.url).toBe("/ari/channels/channel-abc/answer");
  });

  it("reads a channel variable through the real ARI REST endpoint", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({
      baseUrl: fakeAri.baseUrl,
      username: fakeAri.username,
      password: fakeAri.password,
    });

    await expect(client.getChannelVariable("channel-abc", "SIP_CONNECTION_ID")).resolves.toBe("sip-conn-abc");
    expect(fakeAri.lastRequest?.method).toBe("GET");
    expect(fakeAri.lastRequest?.url).toContain("/ari/channels/channel-abc/variable?variable=SIP_CONNECTION_ID");
  });

  it("hangs up a channel and surfaces a real 404 for an unknown channel", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({
      baseUrl: fakeAri.baseUrl,
      username: fakeAri.username,
      password: fakeAri.password,
    });

    await expect(client.hangup("channel-abc", "normal")).resolves.toBeUndefined();
    await expect(client.hangup("missing-channel-id")).rejects.toThrow(/404/);
  });

  it("streams real ARI events in order over a real WebSocket connection", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({
      baseUrl: fakeAri.baseUrl,
      username: fakeAri.username,
      password: fakeAri.password,
    });

    const stream = await client.connectEvents("voicecore-test");

    const received: unknown[] = [];
    const iterator = stream.events()[Symbol.asyncIterator]();
    const collectTwo = (async () => {
      received.push((await iterator.next()).value);
      received.push((await iterator.next()).value);
    })();

    // Give the server a tick to register the connection before sending.
    await new Promise((r) => setTimeout(r, 20));
    fakeAri.wsSend({ type: "StasisStart", timestamp: "2026-08-27T00:00:00.000Z", channel: { id: "channel-abc" } });
    fakeAri.wsSend({ type: "ChannelHangupRequest", timestamp: "2026-08-27T00:00:05.000Z", channel: { id: "channel-abc" } });

    await collectTwo;
    expect(received).toEqual([
      { type: "StasisStart", timestamp: "2026-08-27T00:00:00.000Z", channel: { id: "channel-abc" } },
      { type: "ChannelHangupRequest", timestamp: "2026-08-27T00:00:05.000Z", channel: { id: "channel-abc" } },
    ]);

    await stream.close();
    const afterClose = await iterator.next();
    expect(afterClose.done).toBe(true);
  });

  it("rejects the event stream connection when the api_key is wrong", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: fakeAri.username, password: "wrong" });

    await expect(client.connectEvents("voicecore-test")).rejects.toThrow(/failed to connect/);
  });

  it("fails closed on missing config", () => {
    expect(() => createAsteriskAriConnection({ baseUrl: "", username: "voicecore", password: "s3cret" })).toThrow(
      /baseUrl is required/,
    );
    expect(() => createAsteriskAriConnection({ baseUrl: "http://x", username: "", password: "s3cret" })).toThrow(
      /username is required/,
    );
    expect(() => createAsteriskAriConnection({ baseUrl: "http://x", username: "voicecore", password: "" })).toThrow(
      /password is required/,
    );
  });
});
