// @vitest-environment node
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createSipVoiceBrainClient } from "./brain-client";

interface FakeCrm {
  baseUrl: string;
  lastRequest: { path: string; authHeader: string | null; body: unknown } | null;
  respondWith: { status: number; body: unknown } | null;
  close(): Promise<void>;
}

function startFakeCrmServer(): Promise<FakeCrm> {
  return new Promise((resolve) => {
    const state: FakeCrm = { baseUrl: "", lastRequest: null, respondWith: null, close: async () => {} };

    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        state.lastRequest = {
          path: req.url ?? "",
          authHeader: req.headers["x-internal-secret"] as string | undefined ?? null,
          body: raw ? JSON.parse(raw) : null,
        };
        if (state.respondWith) {
          res.writeHead(state.respondWith.status, { "content-type": "application/json" });
          res.end(JSON.stringify(state.respondWith.body));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: { ok: true } }));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("failed to bind fake CRM server");
      state.baseUrl = `http://127.0.0.1:${address.port}`;
      state.close = () => new Promise<void>((r) => server.close(() => r()));
      resolve(state);
    });
  });
}

describe("SIP voice brain client (Fase 3, real HTTP wire behavior)", () => {
  let fakeCrm: FakeCrm | null = null;

  afterEach(async () => {
    await fakeCrm?.close();
    fakeCrm = null;
  });

  it("resolveContext posts to /api/internal/voice/context with the internal secret header", async () => {
    fakeCrm = await startFakeCrmServer();
    fakeCrm.respondWith = {
      status: 200,
      body: { data: { voice_call_id: "call-1", contact_id: null, caller_kind: "unknown", locale: "pt" } },
    };
    const client = createSipVoiceBrainClient({ baseUrl: fakeCrm.baseUrl, secret: "s3cret" });

    const result = await client.resolveContext({
      provider_call_id: "channel-1",
      connection_id: "sip-conn-abc",
      caller_e164: "+351911234567",
      called_e164: "+351211234567",
      direction: "inbound",
    });

    expect(result).toEqual({ voice_call_id: "call-1", contact_id: null, caller_kind: "unknown", locale: "pt" });
    expect(fakeCrm.lastRequest?.path).toBe("/api/internal/voice/context");
    expect(fakeCrm.lastRequest?.authHeader).toBe("s3cret");
    expect(fakeCrm.lastRequest?.body).toEqual({
      provider_call_id: "channel-1",
      connection_id: "sip-conn-abc",
      caller_e164: "+351911234567",
      called_e164: "+351211234567",
      direction: "inbound",
    });
  });

  it("recordEvent posts to /api/internal/voice/event", async () => {
    fakeCrm = await startFakeCrmServer();
    fakeCrm.respondWith = { status: 200, body: { data: { recorded: true } } };
    const client = createSipVoiceBrainClient({ baseUrl: fakeCrm.baseUrl, secret: "s3cret" });

    const result = await client.recordEvent({
      voice_call_id: "call-1",
      connection_id: "sip-conn-abc",
      phone_e164: "+351211234567",
      state: "active",
      provider_event_id: "channel-1:StasisStart",
    });

    expect(result).toEqual({ recorded: true });
    expect(fakeCrm.lastRequest?.path).toBe("/api/internal/voice/event");
  });

  it("throws a real error with status and code when the CRM rejects the request", async () => {
    fakeCrm = await startFakeCrmServer();
    fakeCrm.respondWith = { status: 409, body: { error: { code: "voice_context_failed", message: "boom" } } };
    const client = createSipVoiceBrainClient({ baseUrl: fakeCrm.baseUrl, secret: "s3cret" });

    await expect(
      client.resolveContext({
        provider_call_id: "channel-1",
        connection_id: "sip-conn-abc",
        caller_e164: "+351911234567",
        called_e164: "+351211234567",
        direction: "inbound",
      }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("voice_context_failed") });
  });

  it("fails closed on missing config", () => {
    expect(() => createSipVoiceBrainClient({ baseUrl: "", secret: "s3cret" })).toThrow(/baseUrl is required/);
    expect(() => createSipVoiceBrainClient({ baseUrl: "http://x", secret: "" })).toThrow(/secret is required/);
  });

  it("runTurn posts to /api/internal/voice/turn and returns the result", async () => {
    fakeCrm = await startFakeCrmServer();
    fakeCrm.respondWith = { status: 200, body: { data: { kind: "reply", text: "oi, tudo bem?" } } };
    const client = createSipVoiceBrainClient({ baseUrl: fakeCrm.baseUrl, secret: "s3cret" });

    const result = await client.runTurn({
      voice_call_id: "00000000-0000-0000-0000-000000000001",
      technical_phone_e164: "+351210000000",
      transcript: "olá",
    });

    expect(result).toEqual({ kind: "reply", text: "oi, tudo bem?" });
    expect(fakeCrm.lastRequest?.path).toBe("/api/internal/voice/turn");
    expect(fakeCrm.lastRequest?.authHeader).toBe("s3cret");
    expect(fakeCrm.lastRequest?.body).toEqual({
      voice_call_id: "00000000-0000-0000-0000-000000000001",
      technical_phone_e164: "+351210000000",
      transcript: "olá",
    });
  });
});
