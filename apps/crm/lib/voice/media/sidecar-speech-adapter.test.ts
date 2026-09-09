import http from "node:http";
import { describe, expect, it, afterEach } from "vitest";
import { createSidecarSpeechAdapter } from "./sidecar-speech-adapter";

async function startFakeSidecar(handler: http.RequestListener): Promise<{ baseUrl: string; close(): Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function frame(data: Uint8Array) {
  return { data, encoding: "mulaw" as const, sampleRateHz: 8000, channels: 1, timestampMs: 0 };
}

describe("sidecar speech adapter — STT", () => {
  let fake: { baseUrl: string; close(): Promise<void> } | null = null;
  afterEach(async () => { await fake?.close(); fake = null; });

  it("junta os frames recebidos, chama POST /stt, devolve um único evento final", async () => {
    let receivedBody: Buffer = Buffer.alloc(0);
    fake = await startFakeSidecar((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks);
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("olá mundo");
      });
    });
    const { stt } = createSidecarSpeechAdapter({ baseUrl: fake.baseUrl });
    async function* frames() {
      yield frame(new Uint8Array([1, 2]));
      yield frame(new Uint8Array([3, 4]));
    }
    const events = [];
    for await (const event of stt.transcribe(frames(), { locale: "pt-PT", signal: new AbortController().signal })) {
      events.push(event);
    }
    expect(events).toEqual([{ type: "final", text: "olá mundo", confidence: null }]);
    expect(receivedBody).toEqual(Buffer.from([1, 2, 3, 4]));
  });
});

describe("sidecar speech adapter — TTS", () => {
  let fake: { baseUrl: string; close(): Promise<void> } | null = null;
  afterEach(async () => { await fake?.close(); fake = null; });

  it("manda o texto pro POST /speak, devolve 1 frame com o áudio", async () => {
    fake = await startFakeSidecar((req, res) => {
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.end(Buffer.from([9, 9, 9]));
    });
    const { tts } = createSidecarSpeechAdapter({ baseUrl: fake.baseUrl });
    const playback = await tts.synthesize("oi", { locale: "pt-PT", signal: new AbortController().signal });
    const chunks = [];
    for await (const f of playback.audio) chunks.push(f);
    expect(chunks).toHaveLength(1);
    expect(Buffer.from(chunks[0]!.data)).toEqual(Buffer.from([9, 9, 9]));
    expect(chunks[0]!.encoding).toBe("mulaw");
    expect(chunks[0]!.sampleRateHz).toBe(8000);
  });

  it("propaga erro do sidecar (500) como falha da porta", async () => {
    fake = await startFakeSidecar((_req, res) => { res.writeHead(500); res.end("boom"); });
    const { tts } = createSidecarSpeechAdapter({ baseUrl: fake.baseUrl });
    await expect(
      tts.synthesize("oi", { locale: "pt-PT", signal: new AbortController().signal }),
    ).rejects.toThrow();
  });
});
