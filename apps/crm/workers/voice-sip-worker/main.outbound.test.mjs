import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolEnd: vi.fn(),
  initiateOutboundCall: vi.fn(),
  recordEvent: vi.fn(),
  listenerClose: vi.fn(),
}));

vi.mock("../../lib/agent-engine/db/pool.ts", () => ({
  createPool: () => ({ end: mocks.poolEnd, query: vi.fn() }),
}));
vi.mock("../../lib/voice/identity/resolve-organization.ts", () => ({
  createVoiceOrganizationResolver: () => ({ resolveByConnection: vi.fn() }),
}));
vi.mock("../../lib/voice/sip/asterisk-ari-client.ts", () => ({
  createAsteriskAriConnection: () => ({ hangup: vi.fn() }),
}));
vi.mock("../../lib/voice/sip/asterisk-adapter.ts", () => ({
  createAsteriskSipGateway: () => ({ initiateOutboundCall: mocks.initiateOutboundCall }),
}));
vi.mock("../../lib/voice/sip/asterisk-listener.ts", () => ({
  createAsteriskAriListener: () => ({
    async *events() {},
    close: mocks.listenerClose,
  }),
}));
vi.mock("../../lib/voice/sip/brain-client.ts", () => ({
  createSipVoiceBrainClient: () => ({ recordEvent: mocks.recordEvent }),
}));
vi.mock("../../lib/voice/sip/event-forwarder.ts", () => ({
  createSipEventForwarder: () => ({ forward: vi.fn() }),
}));

const config = {
  ARI_BASE_URL: "http://127.0.0.1:8088",
  ARI_USERNAME: "test-user",
  ARI_PASSWORD: "test-password",
  ARI_APP_NAME: "test-app",
  SIP_OUTBOUND_CONTEXT: "test-outbound",
  VOICE_CONTROL_PLANE_URL: "http://127.0.0.1:3000",
  INTERNAL_SECRET: "test-internal-secret",
  SUPABASE_DB_URL: "postgres://test:test@127.0.0.1/test",
  PORT: "0",
};

const call = {
  voice_call_id: "11111111-1111-4111-8111-111111111111",
  organization_id: "22222222-2222-4222-8222-222222222222",
  contact_id: "33333333-3333-4333-8333-333333333333",
  agent_id: "44444444-4444-4444-8444-444444444444",
  goal: "Confirmar consulta",
  provider: "asterisk",
  connection_id: "sip-connection-1",
  from_e164: "+351211234567",
  to_e164: "+351912345678",
  first_message: "Olá, estou ligando para confirmar sua consulta.",
};

async function withWorker(run) {
  const { createVoiceSipWorker } = await import("./main.mjs");
  const worker = await createVoiceSipWorker(config);
  await worker.run();
  try {
    await run(`http://127.0.0.1:${worker.healthzPort()}`);
  } finally {
    await worker.stop("test");
  }
}

afterEach(() => {
  vi.clearAllMocks();
  mocks.initiateOutboundCall.mockResolvedValue({ providerCallId: "asterisk-channel-1" });
});

describe("voice SIP worker outbound HTTP contract", () => {
  it("rejects unauthorized requests without originating a call", async () => {
    mocks.initiateOutboundCall.mockResolvedValue({ providerCallId: "asterisk-channel-1" });

    await withWorker(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/calls`, {
        method: "POST",
        headers: { "content-type": "application/json", connection: "close" },
        body: JSON.stringify(call),
      });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthenticated" });
      expect(mocks.initiateOutboundCall).not.toHaveBeenCalled();
    });
  });

  it("accepts one authenticated SIP call and treats a pending retry as a duplicate", async () => {
    mocks.initiateOutboundCall.mockResolvedValue({ providerCallId: "asterisk-channel-1" });

    await withWorker(async (baseUrl) => {
      const send = () => fetch(`${baseUrl}/v1/calls`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": config.INTERNAL_SECRET,
          connection: "close",
        },
        body: JSON.stringify(call),
      });

      const first = await send();
      expect(first.status).toBe(202);
      expect(await first.json()).toEqual({
        accepted: true,
        voice_call_id: call.voice_call_id,
        provider_call_id: "asterisk-channel-1",
      });

      const retry = await send();
      expect(retry.status).toBe(202);
      expect(await retry.json()).toEqual({
        accepted: true,
        duplicate: true,
        voice_call_id: call.voice_call_id,
        provider_call_id: "asterisk-channel-1",
      });
      expect(mocks.initiateOutboundCall).toHaveBeenCalledTimes(1);
      expect(mocks.initiateOutboundCall).toHaveBeenCalledWith({
        voiceCallId: call.voice_call_id,
        organizationId: call.organization_id,
        connectionId: call.connection_id,
        contactId: call.contact_id,
        agentId: call.agent_id,
        goal: call.goal,
        fromE164: call.from_e164,
        toE164: call.to_e164,
      });
      expect(mocks.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
        voice_call_id: call.voice_call_id,
        state: "connecting",
        provider_call_id: "asterisk-channel-1",
      }));
    });
  });
});
