import assert from "node:assert/strict";
import test from "node:test";

import { startVoiceControlServer } from "./control-server.mjs";

function pendingStub() {
  const reserveCalls = [];
  return {
    reserveCalls,
    size: () => 0,
    reserve: (input) => {
      reserveCalls.push(input);
      return { toE164: input.toE164, voiceCallId: input.voiceCallId, organizationId: input.organizationId };
    },
    release: () => {},
  };
}

async function withServer(readinessCheck, run) {
  let callCount = 0;
  const pendingOutbound = pendingStub();
  const phone = {
    call: async () => { callCount += 1; },
  };
  const server = await startVoiceControlServer({
    phone,
    agent: {},
    secret: "test-secret",
    liveEnabled: true,
    port: 0,
    pendingOutbound,
    readinessCheck,
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
      getCallCount: () => callCount,
      reserveCalls: pendingOutbound.reserveCalls,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("healthz is degraded while local speech is unavailable", async () => {
  await withServer(async () => false, async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.status, "degraded");
    assert.equal(body.local_speech_ready, false);
  });
});

test("outbound call is rejected before dialing while local speech is unavailable", async () => {
  await withServer(async () => false, async ({ baseUrl, getCallCount }) => {
    const response = await fetch(`${baseUrl}/v1/calls`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": "test-secret",
      },
      body: JSON.stringify({ voice_call_id: "call-1", organization_id: "org-1", to_e164: "+351210000000" }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "local_speech_unavailable");
    assert.equal(getCallCount(), 0);
  });
});

test("healthz is healthy when local speech is ready", async () => {
  await withServer(async () => true, async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "ok");
    assert.equal(body.local_speech_ready, true);
  });
});

test("outbound control request carries organization id into the pending reservation", async () => {
  await withServer(async () => true, async ({ baseUrl, reserveCalls, getCallCount }) => {
    const response = await fetch(`${baseUrl}/v1/calls`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": "test-secret",
      },
      body: JSON.stringify({
        voice_call_id: "call-1",
        organization_id: "org-1",
        to_e164: "+351210000000",
        first_message: "Olá",
      }),
    });
    assert.equal(response.status, 202);
    assert.equal(getCallCount(), 1);
    assert.deepEqual(reserveCalls, [{ toE164: "+351210000000", voiceCallId: "call-1", organizationId: "org-1" }]);
  });
});

test("outbound control request fails closed without organization id", async () => {
  await withServer(async () => true, async ({ baseUrl, getCallCount, reserveCalls }) => {
    const response = await fetch(`${baseUrl}/v1/calls`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": "test-secret",
      },
      body: JSON.stringify({ voice_call_id: "call-1", to_e164: "+351210000000" }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error, "organization_id_required");
    assert.equal(getCallCount(), 0);
    assert.deepEqual(reserveCalls, []);
  });
});
