import assert from "node:assert/strict";
import test from "node:test";

import { normalizeVoiceDeliveryForLog } from "./delivery-log.mjs";

test("normalizes only provider-neutral delivery labels", () => {
  assert.deepEqual(
    normalizeVoiceDeliveryForLog({ affect: "empathetic", pace: "slow", energy: 0.35, tone: "warm", text: "secret" }),
    { affect: "empathetic", pace: "slow", energy: 0.35, tone: "warm" },
  );
});

test("rejects malformed delivery metadata", () => {
  assert.equal(normalizeVoiceDeliveryForLog({ affect: "invented", pace: "slow", energy: 0.3, tone: "warm" }), null);
  assert.equal(normalizeVoiceDeliveryForLog({ affect: "warm", pace: "slow", energy: 99, tone: "warm" }), null);
  assert.equal(normalizeVoiceDeliveryForLog(null), null);
});
