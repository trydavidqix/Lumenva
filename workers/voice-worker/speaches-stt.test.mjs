import assert from "node:assert/strict";
import test from "node:test";

import { SpeachesFasterWhisperSTT, pcm16MonoToWav } from "./speaches-stt.mjs";

function responseJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("pcm16MonoToWav writes a valid mono PCM16 WAV header", () => {
  const pcm = Buffer.from([1, 0, 2, 0, 3, 0, 4, 0]);
  const wav = pcm16MonoToWav(pcm, 16_000);
  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(wav.subarray(8, 12).toString("ascii"), "WAVE");
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 16_000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.deepEqual(wav.subarray(44), pcm);
});

test("finalize sends one local transcription request and emits a final transcript", async () => {
  const calls = [];
  const stt = new SpeachesFasterWhisperSTT({
    baseUrl: "http://speech.local:8000",
    model: "local-whisper",
    language: "pt",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return responseJson({ text: "  olá mundo  " });
    },
  });
  await stt.connect();

  const transcript = new Promise((resolve) => stt.onTranscript(resolve));
  stt.sendAudio(Buffer.alloc(640, 1));
  stt.finalize();

  const result = await transcript;
  assert.equal(result.text, "olá mundo");
  assert.equal(result.isFinal, true);
  assert.equal(result.speechFinal, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://speech.local:8000/v1/audio/transcriptions");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers, undefined, "local runtime must not require an API-key header");
  assert.ok(calls[0].init.body instanceof FormData);
  assert.equal(calls[0].init.body.get("model"), "local-whisper");
  assert.equal(calls[0].init.body.get("language"), "pt");
});

test("clone keeps per-call audio buffers isolated", async () => {
  let requests = 0;
  const fetchImpl = async () => {
    requests += 1;
    return responseJson({ text: `turn-${requests}` });
  };
  const template = new SpeachesFasterWhisperSTT({
    baseUrl: "http://speech.local:8000",
    model: "local-whisper",
    fetchImpl,
  });
  const callA = template.clone();
  const callB = template.clone();
  await callA.connect();
  await callB.connect();

  const a = new Promise((resolve) => callA.onTranscript(resolve));
  const b = new Promise((resolve) => callB.onTranscript(resolve));
  callA.sendAudio(Buffer.alloc(320, 1));
  callB.sendAudio(Buffer.alloc(640, 2));
  callA.finalize();
  callB.finalize();

  const [ta, tb] = await Promise.all([a, b]);
  assert.equal(ta.text, "turn-1");
  assert.equal(tb.text, "turn-2");
  assert.equal(requests, 2);
});

test("utterance buffer is bounded and reports a controlled error", async () => {
  let fetchCalls = 0;
  const stt = new SpeachesFasterWhisperSTT({
    baseUrl: "http://speech.local:8000",
    model: "local-whisper",
    sampleRate: 16_000,
    maxUtteranceSeconds: 0.01,
    fetchImpl: async () => {
      fetchCalls += 1;
      return responseJson({ text: "should not happen" });
    },
  });
  await stt.connect();
  const error = new Promise((resolve) => stt.onError(resolve));
  stt.sendAudio(Buffer.alloc(1_000, 1));
  const result = await error;
  assert.match(result.message, /buffer_limit_exceeded/);
  stt.finalize();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fetchCalls, 0);
});

test("close drops later audio instead of leaking a transcript into another call", async () => {
  let fetchCalls = 0;
  const stt = new SpeachesFasterWhisperSTT({
    baseUrl: "http://speech.local:8000",
    model: "local-whisper",
    fetchImpl: async () => {
      fetchCalls += 1;
      return responseJson({ text: "late" });
    },
  });
  await stt.connect();
  stt.close();
  stt.sendAudio(Buffer.alloc(320, 1));
  stt.finalize();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fetchCalls, 0);
});

test("close aborts an in-flight local transcription and suppresses late callbacks", async () => {
  let fetchStartedResolve;
  const fetchStarted = new Promise((resolve) => { fetchStartedResolve = resolve; });
  let transcriptCount = 0;
  let errorCount = 0;
  const stt = new SpeachesFasterWhisperSTT({
    baseUrl: "http://speech.local:8000",
    model: "local-whisper",
    fetchImpl: async (_url, init) => {
      fetchStartedResolve();
      await new Promise((resolve, reject) => {
        if (init.signal.aborted) return reject(init.signal.reason);
        init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
      });
      return responseJson({ text: "late" });
    },
  });
  await stt.connect();
  stt.onTranscript(() => { transcriptCount += 1; });
  stt.onError(() => { errorCount += 1; });
  stt.sendAudio(Buffer.alloc(320, 1));
  stt.finalize();
  await fetchStarted;
  stt.close();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(transcriptCount, 0);
  assert.equal(errorCount, 0);
});
