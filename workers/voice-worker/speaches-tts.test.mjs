import assert from "node:assert/strict";
import test from "node:test";

import { encodeVoiceDeliveryEnvelope } from "./delivery-context.mjs";
import { SpeachesFailoverTTS, SpeachesLocalTTS } from "./speaches-tts.mjs";

function streamResponse(chunks, status = 200) {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(Uint8Array.from(chunk));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "content-type": "audio/pcm" } });
}

test("local TTS sends a keyless PCM16/16k request to Speaches", async () => {
  const calls = [];
  const tts = new SpeachesLocalTTS({
    baseUrl: "http://speech.local:8000",
    model: "speaches-ai/Kokoro-82M-v1.0-ONNX",
    voice: "configured-voice",
    speed: 0.9,
    chunkBytes: 4,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return streamResponse([[1, 2, 3], [4, 5, 6]]);
    },
  });

  const chunks = [];
  for await (const chunk of tts.synthesizeStream("Olá")) chunks.push(chunk);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://speech.local:8000/v1/audio/speech");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, { "content-type": "application/json" });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, "speaches-ai/Kokoro-82M-v1.0-ONNX");
  assert.equal(body.voice, "configured-voice");
  assert.equal(body.input, "Olá");
  assert.equal(body.response_format, "pcm");
  assert.equal(body.sample_rate, 16_000);
  assert.equal(body.speed, 0.9);
  assert.equal(body.stream_format, "audio");
  assert.deepEqual(Buffer.concat(chunks), Buffer.from([1, 2, 3, 4, 5, 6]));
});

test("call-scoped delivery envelope is stripped and mapped to request speed", async () => {
  const bodies = [];
  const tts = new SpeachesLocalTTS({
    baseUrl: "http://speech.local:8000",
    model: "kokoro",
    voice: "voice-a",
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return streamResponse([[1]]);
    },
  });
  const text = encodeVoiceDeliveryEnvelope("Vou verificar isso contigo.", {
    affect: "empathetic",
    pace: "slow",
    energy: 0.35,
    tone: "warm",
  });

  await tts.synthesize(text);
  assert.equal(bodies[0].input, "Vou verificar isso contigo.");
  assert.equal(bodies[0].speed, 0.92);
  assert.doesNotMatch(bodies[0].input, /LUMENVA_VOICE/);
});

test("shared local TTS instance keeps concurrent call speeds isolated", async () => {
  const bodies = [];
  const tts = new SpeachesLocalTTS({
    baseUrl: "http://speech.local:8000",
    model: "kokoro",
    voice: "voice-a",
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      await new Promise((resolve) => setTimeout(resolve, 5));
      return streamResponse([[1]]);
    },
  });
  const slow = encodeVoiceDeliveryEnvelope("Calma.", {
    affect: "empathetic",
    pace: "slow",
    energy: 0.35,
    tone: "warm",
  });
  const fast = encodeVoiceDeliveryEnvelope("Perfeito!", {
    affect: "upbeat",
    pace: "fast",
    energy: 0.7,
    tone: "bright",
  });

  await Promise.all([tts.synthesize(slow), tts.synthesize(fast)]);
  const byInput = new Map(bodies.map((body) => [body.input, body.speed]));
  assert.equal(byInput.get("Calma."), 0.92);
  assert.equal(byInput.get("Perfeito!"), 1.06);
  assert.equal(tts.speed, 1, "base provider speed must remain immutable across calls");
});

test("synthesize joins the streamed chunks", async () => {
  const tts = new SpeachesLocalTTS({
    baseUrl: "http://speech.local:8000",
    model: "kokoro",
    voice: "voice-a",
    fetchImpl: async () => streamResponse([[1, 2], [3, 4]]),
  });
  assert.deepEqual(await tts.synthesize("hello"), Buffer.from([1, 2, 3, 4]));
});

test("failover uses Piper only when primary fails before first audio", async () => {
  const used = [];
  const primary = {
    outputFormat: "pcm_16000",
    async *synthesizeStream() {
      used.push("primary");
      throw new Error("kokoro unavailable");
    },
  };
  const fallback = {
    outputFormat: "pcm_16000",
    async *synthesizeStream() {
      used.push("fallback");
      yield Buffer.from([9, 8, 7]);
    },
  };
  const tts = new SpeachesFailoverTTS({ primary, fallback });
  const chunks = [];
  for await (const chunk of tts.synthesizeStream("hello")) chunks.push(chunk);
  assert.deepEqual(used, ["primary", "fallback"]);
  assert.deepEqual(Buffer.concat(chunks), Buffer.from([9, 8, 7]));
});

test("failover never switches voice after primary audio was already emitted", async () => {
  let fallbackUsed = false;
  const primary = {
    outputFormat: "pcm_16000",
    async *synthesizeStream() {
      yield Buffer.from([1, 2]);
      throw new Error("primary failed mid-sentence");
    },
  };
  const fallback = {
    outputFormat: "pcm_16000",
    async *synthesizeStream() {
      fallbackUsed = true;
      yield Buffer.from([9]);
    },
  };
  const tts = new SpeachesFailoverTTS({ primary, fallback });
  const received = [];
  await assert.rejects(async () => {
    for await (const chunk of tts.synthesizeStream("hello")) received.push(chunk);
  }, /primary failed mid-sentence/);
  assert.deepEqual(Buffer.concat(received), Buffer.from([1, 2]));
  assert.equal(fallbackUsed, false);
});

test("local TTS validates model, voice and non-empty text", async () => {
  assert.throws(() => new SpeachesLocalTTS({ baseUrl: "http://speech.local", voice: "v" }), /model is required/);
  assert.throws(() => new SpeachesLocalTTS({ baseUrl: "http://speech.local", model: "m" }), /voice is required/);

  const tts = new SpeachesLocalTTS({
    baseUrl: "http://speech.local",
    model: "m",
    voice: "v",
    fetchImpl: async () => streamResponse([[1]]),
  });
  await assert.rejects(async () => {
    for await (const _chunk of tts.synthesizeStream("   ")) {
      // no-op
    }
  }, /local_tts_empty_text/);
});
