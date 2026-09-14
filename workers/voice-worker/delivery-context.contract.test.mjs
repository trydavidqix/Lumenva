import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const here = new URL(".", import.meta.url);

const read = (name) => readFileSync(new URL(name, here), "utf8");

test("worker exposes a call-scoped delivery bridge before local TTS", () => {
  assert.equal(existsSync(new URL("delivery-context.mjs", here)), true, "delivery-context.mjs must exist");
  const main = read("main.mjs");
  const tts = read("speaches-tts.mjs");

  assert.match(main, /beforeSynthesize/);
  assert.match(main, /recordDelivery/);
  assert.match(main, /decorateSentence/);
  assert.match(main, /clearDelivery/);
  assert.match(tts, /decodeVoiceDeliveryEnvelope/);
  assert.match(tts, /resolveDeliverySpeed/);
});
