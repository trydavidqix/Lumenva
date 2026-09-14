import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { createVoiceBrainClient } from "./brain-client.mjs";

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("runTurn preserves delivery metadata returned by the CRM control plane", async () => {
  const delivery = { affect: "empathetic", pace: "slow", energy: 0.35, tone: "warm" };
  await withServer((req, res) => {
    assert.equal(req.url, "/api/internal/voice/turn");
    assert.equal(req.method, "POST");
    assert.equal(req.headers["x-internal-secret"], "test-secret");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      data: {
        kind: "reply",
        text: "Entendi. Vou verificar.",
        agentId: "atendimento",
        runId: "run-1",
        traceId: "trace-1",
        delivery,
      },
    }));
  }, async (baseUrl) => {
    const client = createVoiceBrainClient({
      VOICE_CONTROL_PLANE_URL: baseUrl,
      INTERNAL_SECRET: "test-secret",
    });
    const result = await client.runTurn({
      voice_call_id: "call-1",
      technical_phone_e164: "+351210000000",
      transcript: "Estou frustrado.",
    });
    assert.deepEqual(result.delivery, delivery);
    assert.equal(result.text, "Entendi. Vou verificar.");
  });
});
