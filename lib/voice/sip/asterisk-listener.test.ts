// @vitest-environment node
// Same reason as asterisk-ari-client.test.ts: this exercises a real
// WebSocket connection, which needs Node's real globals, not jsdom's.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAsteriskAriConnection } from "./asterisk-ari-client";
import { createAsteriskSipGateway } from "./asterisk-adapter";
import { createAsteriskAriListener } from "./asterisk-listener";
import { createVoiceOrganizationResolver, type VoiceOrganizationQueryable } from "../identity/resolve-organization";
import { startFakeAriServer, type FakeAriServer } from "./testing/fake-ari-server";

/**
 * An in-memory fake standing in for Postgres, shaped like the real schema
 * (`voice_sip_connections` verified+enabled, `voice_phone_numbers` scoped to
 * a connection). This runs the real `createVoiceOrganizationResolver` SQL
 * logic against fake rows — not a mock of `resolveOrganizationByConnection`
 * itself — so the listener test proves real tenant-resolution wiring, not
 * just that some function got called.
 */
function fakeDb(options: {
  connections: Array<{ id: string; gateway: string; externalConnectionId: string; organizationId: string }>;
  numbers: Array<{ connectionId: string; phoneE164: string; organizationId: string }>;
}): VoiceOrganizationQueryable {
  return {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<{ rows: T[] }> {
      if (sql.includes("voice_sip_connections")) {
        const [gateway, externalConnectionId] = params as [string, string];
        const rows = options.connections
          .filter((c) => c.gateway === gateway && c.externalConnectionId === externalConnectionId)
          .map((c) => ({ id: c.id, organization_id: c.organizationId }));
        return { rows: rows as unknown as T[] };
      }
      if (sql.includes("voice_phone_numbers")) {
        const [connectionId, phoneE164, organizationId] = params as [string, string, string];
        const rows = options.numbers
          .filter((n) => n.connectionId === connectionId && n.phoneE164 === phoneE164 && n.organizationId === organizationId)
          .map((n) => ({ organization_id: n.organizationId }));
        return { rows: rows as unknown as T[] };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
}

const VERIFIED_CONNECTION = {
  id: "conn-1",
  gateway: "asterisk",
  externalConnectionId: "sip-conn-abc",
  organizationId: "org-1",
};
const REGISTERED_NUMBER = { connectionId: "conn-1", phoneE164: "+351211234567", organizationId: "org-1" };

function stasisStart(overrides: Partial<{ channelId: string; connectionId: string }> = {}) {
  return {
    type: "StasisStart",
    timestamp: "2026-08-28T00:00:00.000Z",
    channel: {
      id: overrides.channelId ?? "channel-1",
      caller: { number: "+351911234567" },
      connected: { number: "+351211234567" },
      channelvars: { SIP_CONNECTION_ID: overrides.connectionId ?? "sip-conn-abc" },
    },
  };
}

describe("Asterisk ARI listener (Fase 3, tenant-resolved real events)", () => {
  let fakeAri: FakeAriServer | null = null;

  afterEach(async () => {
    await fakeAri?.close();
    fakeAri = null;
  });

  function buildGateway() {
    const db = fakeDb({ connections: [VERIFIED_CONNECTION], numbers: [REGISTERED_NUMBER] });
    const resolver = createVoiceOrganizationResolver(db);
    return createAsteriskSipGateway({
      directory: { resolveOrganizationByConnection: (connId, calledE164) => resolver.resolveByConnection("asterisk", connId, calledE164) },
      ariClient: { originate: vi.fn() },
      outboundContext: "lumenva-voice",
    });
  }

  it("normalizes a real StasisStart event with real tenant resolution", async () => {
    fakeAri = await startFakeAriServer();
    const connection = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: fakeAri.username, password: fakeAri.password });
    const listener = await createAsteriskAriListener({ connection, gateway: buildGateway(), appName: "voicecore-test" });

    const iterator = listener.events()[Symbol.asyncIterator]();
    const receivedPromise = iterator.next();
    await new Promise((r) => setTimeout(r, 20));
    fakeAri.wsSend(stasisStart());

    const result = await receivedPromise;
    expect(result.done).toBe(false);
    expect(result.value).toEqual({
      status: "normalized",
      event: {
        organizationId: "org-1",
        connectionId: "sip-conn-abc",
        gateway: "asterisk",
        providerEventId: "channel-1",
        eventType: "StasisStart",
        occurredAt: "2026-08-28T00:00:00.000Z",
        direction: "inbound",
        callerE164: "+351911234567",
        calledE164: "+351211234567",
        attributes: { callControlId: "channel-1", callSessionId: null },
      },
    });

    await listener.close();
  });

  it("keeps running past an unsupported event and still normalizes the next good one", async () => {
    fakeAri = await startFakeAriServer();
    const connection = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: fakeAri.username, password: fakeAri.password });
    const listener = await createAsteriskAriListener({ connection, gateway: buildGateway(), appName: "voicecore-test" });

    const iterator = listener.events()[Symbol.asyncIterator]();
    const first = iterator.next();
    const second = iterator.next();

    await new Promise((r) => setTimeout(r, 20));
    fakeAri.wsSend({ type: "ChannelVarset", timestamp: "2026-08-28T00:00:01.000Z" });
    fakeAri.wsSend(stasisStart({ channelId: "channel-2" }));

    const firstResult = await first;
    expect(firstResult.value).toMatchObject({ status: "rejected" });
    expect((firstResult.value as { error: Error }).error.message).toMatch(/unsupported/i);

    const secondResult = await second;
    expect(secondResult.value).toMatchObject({ status: "normalized", event: { providerEventId: "channel-2" } });

    await listener.close();
  });

  it("rejects an event from an unknown SIP connection without crashing the loop", async () => {
    fakeAri = await startFakeAriServer();
    const connection = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: fakeAri.username, password: fakeAri.password });
    const listener = await createAsteriskAriListener({ connection, gateway: buildGateway(), appName: "voicecore-test" });

    const iterator = listener.events()[Symbol.asyncIterator]();
    const receivedPromise = iterator.next();
    await new Promise((r) => setTimeout(r, 20));
    fakeAri.wsSend(stasisStart({ connectionId: "unknown-connection" }));

    const result = await receivedPromise;
    expect(result.value).toMatchObject({ status: "rejected" });
    expect((result.value as { error: Error }).error.message).toMatch(/organization not found/i);

    await listener.close();
  });

  it("ends the iterator cleanly when close() is called", async () => {
    fakeAri = await startFakeAriServer();
    const connection = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: fakeAri.username, password: fakeAri.password });
    const listener = await createAsteriskAriListener({ connection, gateway: buildGateway(), appName: "voicecore-test" });

    await listener.close();
    const iterator = listener.events()[Symbol.asyncIterator]();
    const result = await iterator.next();
    expect(result.done).toBe(true);
  });

  it("reconnects automatically after an unexpected drop and keeps normalizing events", async () => {
    fakeAri = await startFakeAriServer();
    const connection = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: fakeAri.username, password: fakeAri.password });
    const listener = await createAsteriskAriListener({
      connection,
      gateway: buildGateway(),
      appName: "voicecore-test",
      wait: async () => {}, // no real delay in tests
    });

    const iterator = listener.events()[Symbol.asyncIterator]();

    const beforeDrop = iterator.next();
    await new Promise((r) => setTimeout(r, 20));
    fakeAri.wsSend(stasisStart({ channelId: "channel-before-drop" }));
    expect((await beforeDrop).value).toMatchObject({ status: "normalized", event: { providerEventId: "channel-before-drop" } });

    const afterReconnect = iterator.next();
    fakeAri.dropConnection();
    // Give the client's socket-close event and the listener's reconnect loop
    // time to re-establish a fresh WS connection to the same fake server.
    await new Promise((r) => setTimeout(r, 100));
    fakeAri.wsSend(stasisStart({ channelId: "channel-after-reconnect" }));

    const result = await afterReconnect;
    expect(result.value).toMatchObject({ status: "normalized", event: { providerEventId: "channel-after-reconnect" } });

    await listener.close();
  });

  it("does not reconnect after close() was called explicitly", async () => {
    fakeAri = await startFakeAriServer();
    const connection = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: fakeAri.username, password: fakeAri.password });
    const listener = await createAsteriskAriListener({
      connection,
      gateway: buildGateway(),
      appName: "voicecore-test",
      wait: async () => {},
    });

    const iterator = listener.events()[Symbol.asyncIterator]();
    const pending = iterator.next();
    await listener.close();

    const result = await pending;
    expect(result.done).toBe(true);
  });
});
