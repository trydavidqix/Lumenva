import test from "node:test";
import assert from "node:assert/strict";
import { createPendingOutboundRegistry } from "./pending-outbound.mjs";

test("reserves and consumes one outbound context per destination", () => {
  const registry = createPendingOutboundRegistry({ ttlMs: 30_000, now: () => 1_000 });
  registry.reserve({ toE164: "+351912345678", voiceCallId: "voice-1" });
  assert.throws(
    () => registry.reserve({ toE164: "+351912345678", voiceCallId: "voice-2" }),
    /outbound_destination_busy/,
  );
  assert.deepEqual(registry.consume("+351912345678"), {
    toE164: "+351912345678",
    voiceCallId: "voice-1",
    reservedAt: 1_000,
  });
  assert.equal(registry.consume("+351912345678"), null);
});

test("expires stale reservations fail closed", () => {
  let now = 1_000;
  const registry = createPendingOutboundRegistry({ ttlMs: 5_000, now: () => now });
  registry.reserve({ toE164: "+351912345678", voiceCallId: "voice-1" });
  now = 7_000;
  assert.equal(registry.consume("+351912345678"), null);
  registry.reserve({ toE164: "+351912345678", voiceCallId: "voice-2" });
  assert.equal(registry.size(), 1);
});

test("validates E.164 and voice call id", () => {
  const registry = createPendingOutboundRegistry();
  assert.throws(() => registry.reserve({ toE164: "9123", voiceCallId: "voice-1" }), /invalid_e164/);
  assert.throws(() => registry.reserve({ toE164: "+351912345678", voiceCallId: "" }), /voice_call_id_required/);
});
