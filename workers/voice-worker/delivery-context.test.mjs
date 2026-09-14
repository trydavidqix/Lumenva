import assert from "node:assert/strict";
import test from "node:test";

import {
  createCallDeliveryContext,
  decodeVoiceDeliveryEnvelope,
  encodeVoiceDeliveryEnvelope,
  resolveDeliverySpeed,
} from "./delivery-context.mjs";

const slowWarm = { affect: "empathetic", pace: "slow", energy: 0.35, tone: "warm" };
const fastBright = { affect: "upbeat", pace: "fast", energy: 0.7, tone: "bright" };

test("delivery envelope round-trips provider-neutral metadata without changing spoken text", () => {
  const wrapped = encodeVoiceDeliveryEnvelope("Olá. Tudo bem?", slowWarm);
  const decoded = decodeVoiceDeliveryEnvelope(wrapped);
  assert.equal(decoded.text, "Olá. Tudo bem?");
  assert.deepEqual(decoded.delivery, slowWarm);
});

test("corrupt internal envelope is never exposed as speakable text", () => {
  assert.deepEqual(
    decodeVoiceDeliveryEnvelope("[[LUMENVA_VOICE_V1:not-valid"),
    { text: "", delivery: null },
  );
});

test("delivery speed changes only by bounded pace factor", () => {
  assert.equal(resolveDeliverySpeed(slowWarm, 1), 0.92);
  assert.equal(resolveDeliverySpeed(fastBright, 1), 1.06);
  assert.equal(resolveDeliverySpeed({ affect: "warm", pace: "normal", energy: 0.5, tone: "warm" }, 0.95), 0.95);
});

test("two concurrent calls keep independent delivery styles", () => {
  const context = createCallDeliveryContext();
  context.recordDelivery({ callId: "call-a", text: "Entendi. Vou verificar.", delivery: slowWarm });
  context.recordDelivery({ callId: "call-b", text: "Perfeito! Seguimos.", delivery: fastBright });

  const a = decodeVoiceDeliveryEnvelope(context.decorateSentence("call-a", "Entendi."));
  const b = decodeVoiceDeliveryEnvelope(context.decorateSentence("call-b", "Perfeito!"));
  assert.deepEqual(a.delivery, slowWarm);
  assert.deepEqual(b.delivery, fastBright);
});

test("recent responses are retained so a cancelled older turn cannot inherit a newer style", () => {
  const context = createCallDeliveryContext({ maxResponsesPerCall: 4 });
  context.recordDelivery({ callId: "call-a", text: "Primeira frase. Segunda antiga.", delivery: slowWarm });
  context.recordDelivery({ callId: "call-a", text: "Nova resposta.", delivery: fastBright });

  const oldSentence = decodeVoiceDeliveryEnvelope(context.decorateSentence("call-a", "Segunda antiga."));
  const newSentence = decodeVoiceDeliveryEnvelope(context.decorateSentence("call-a", "Nova resposta."));
  assert.deepEqual(oldSentence.delivery, slowWarm);
  assert.deepEqual(newSentence.delivery, fastBright);
});

test("unknown sentence fails safe to provider default instead of guessing emotion", () => {
  const context = createCallDeliveryContext();
  context.recordDelivery({ callId: "call-a", text: "Resposta conhecida.", delivery: slowWarm });
  assert.equal(context.decorateSentence("call-a", "Texto que não pertence à resposta."), "Texto que não pertence à resposta.");
});

test("clearDelivery removes all delivery state for a finished call", () => {
  const context = createCallDeliveryContext();
  context.recordDelivery({ callId: "call-a", text: "Resposta conhecida.", delivery: slowWarm });
  context.clearDelivery("call-a");
  assert.equal(context.size(), 0);
  assert.equal(context.decorateSentence("call-a", "Resposta conhecida."), "Resposta conhecida.");
});

test("delivery context expires stale responses", () => {
  let clock = 1_000;
  const context = createCallDeliveryContext({ ttlMs: 5_000, now: () => clock });
  context.recordDelivery({ callId: "call-a", text: "Resposta antiga.", delivery: slowWarm });
  clock = 7_000;
  assert.equal(context.decorateSentence("call-a", "Resposta antiga."), "Resposta antiga.");
  assert.equal(context.size(), 0);
});
