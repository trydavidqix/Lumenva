# Unificar SIP Worker + Mídia de Voz Provada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer `workers/voice-sip-worker/main.mjs` (o processo real de sinalização SIP/BYOC)
atender uma ligação telefônica de ponta a ponta usando o Agent OS real — Asterisk → RTP → STT →
`/api/internal/voice/turn` (Agent OS, tenant/tools reais) → TTS → RTP → telefone.

**Architecture:** liga três peças já testadas isoladamente (RTP bridge, turn-service via HTTP
interno, e um novo adapter fino que fala com o sidecar Python já provado na VPS) dentro do
mesmo processo `main.mjs`, em modo lote (1 chamada HTTP por turno, sem streaming de verdade).

**Tech Stack:** Node.js (`.mjs`/`tsx`), TypeScript (`lib/voice/**`), Vitest, Python (sidecar
existente, só ganha 1 endpoint novo).

**Spec:** `docs/superpowers/specs/2026-08-29-voice-unify-sip-worker-media-design.md`

## Global Constraints

- Modo lote, não streaming: cada porta (`StreamingSttPort`/`StreamingTtsPort`) faz 1 chamada HTTP
  por turno e devolve 1 evento/1 frame — nunca parcial.
- Nenhuma falha de uma chamada derruba o processo `main.mjs` nem afeta outras chamadas — sempre
  logar e seguir, nunca propagar exceção pro loop principal do worker.
- Janela de captura fixa de 4000ms por turno (mesmo valor já provado em
  `/opt/voice-vps-bench/audio_bridge_v15.mjs`, `LISTEN_MS`), configurável via env var com esse
  default.
- Pacotes RTP saem a cada 20ms de forma **contínua** (silêncio quando não há reply na fila) — não
  em rajada. Rajada foi causa raiz de um bug de jitter já corrigido; não reintroduzir.
- Sidecar Python (`voice_worker_server_v12.py` na VPS) só recebe adições (endpoint novo), nunca
  edição do que já existe (`/turn`, `/speak`, `/play_elevenlabs_test` continuam intocados).
- `organization_id` nunca vem do body do request — sempre resolvido via `voice_call_id` já
  autenticado (mesmo padrão que `/api/internal/voice/turn` já usa).

---

### Task 1: Corrigir `/api/internal/voice/turn` pra aceitar chamadas SIP/BYOC

Hoje a rota só encontra a chamada quando `voice_phone_numbers.provider = 'telnyx'` — uma ligação
SIP/BYOC (`provider = 'asterisk'`, resolvida via `voice_sip_connections`) nunca bate no `where` e
a rota sempre devolve `409 voice_call_not_active`, mesmo pra uma chamada ativa de verdade. Achado
lendo o código nesta sessão, não estava na spec original.

**Files:**
- Modify: `app/api/internal/voice/turn/route.ts:44-63`
- Test: `app/api/internal/voice/turn/route.test.ts` (criar — não existe hoje)

**Interfaces:**
- Consumes: nada de outra task.
- Produces: `POST /api/internal/voice/turn` aceita chamadas com `voice_phone_numbers.provider IN
  ('telnyx', 'asterisk')`. Contrato de request/response inalterado (mesmo `bodySchema`, mesmo
  `ok(result, { requestId })`).

- [ ] **Step 1: Ler o teste existente da rota `/context` pra ver o padrão de teste de rota do
  repo** (`app/api/internal/voice/context/route.test.ts`, se existir; senão
  `tests/unit/voice-worker-tenant-binding-contract.test.ts`) e copiar o padrão de mock de
  `getRequestPool`/`checkRateLimit` usado lá — não inventar um novo padrão de teste de rota.

- [ ] **Step 2: Escrever o teste que falha primeiro**, provando que uma chamada SIP/BYOC ativa
  (`voice_phone_numbers.provider = 'asterisk'`) hoje é rejeitada:

```typescript
// app/api/internal/voice/turn/route.test.ts
import { describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
vi.mock("@/lib/agent-engine/db/request-pool", () => ({
  getRequestPool: () => ({ query: queryMock }),
}));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock("@/lib/env", () => ({ env: { INTERNAL_SECRET: "test-secret" } }));
vi.mock("@/lib/voice/runtime/kernel-runtime", () => ({
  createVoiceProductionKernel: vi.fn(),
}));
vi.mock("@/lib/voice/runtime/delivery-policy", () => ({
  createProductAgentVoiceDeliveryAuthorizer: vi.fn(),
}));
vi.mock("@/lib/voice/runtime/turn-service", () => ({
  createVoiceTurnService: () => ({
    run: vi.fn().mockResolvedValue({ kind: "reply", text: "ok", agentId: "a", runId: "r", traceId: "t" }),
  }),
}));

async function callRoute(body: unknown) {
  const { POST } = await import("./route");
  const req = new Request("http://internal/api/internal/voice/turn", {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": "test-secret" },
    body: JSON.stringify(body),
  });
  return POST(req as unknown as Parameters<typeof POST>[0]);
}

describe("POST /api/internal/voice/turn — caminho SIP/BYOC (asterisk)", () => {
  it("aceita uma chamada ativa cujo número técnico é provider=asterisk", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ organization_id: "org-1", contact_id: null }],
    });
    const res = await callRoute({
      voice_call_id: "00000000-0000-0000-0000-000000000001",
      technical_phone_e164: "+351210000000",
      transcript: "olá",
    });
    expect(res.status).toBe(200);
    // A query precisa aceitar 'asterisk', não só 'telnyx' — prova via SQL efetivamente executado.
    const [sql] = queryMock.mock.calls[0]!;
    expect(sql).toMatch(/provider = any\(\$3\)|provider in \('telnyx', ?'asterisk'\)/i);
  });
});
```

- [ ] **Step 2b: Rodar o teste, confirmar que falha** (a asserção do `sql` não bate porque hoje é
  `vpn.provider = 'telnyx'` fixo — sem `$3` nenhum).

Run: `npx vitest run app/api/internal/voice/turn/route.test.ts`
Expected: FAIL (asserção do SQL não bate)

- [ ] **Step 3: Corrigir a query** — trocar o literal fixo por um parâmetro de lista, mesmo
  padrão de `IN`/`ANY` que outras rotas do repo já usam para vocabulário fechado:

```typescript
// app/api/internal/voice/turn/route.ts — dentro do POST, troca o db.query existente
    const { rows } = await db.query<{ organization_id: string; contact_id: string | null }>(
      `select vc.organization_id, vc.contact_id
         from voice_calls vc
         join voice_phone_numbers vpn
           on vpn.organization_id = vc.organization_id
          and vpn.provider = any($3)
          and vpn.phone_e164 = $2
          and vpn.enabled = true
        where vc.id = $1
          and vc.state not in ('completed','failed','canceled')
          and (
            (vc.direction = 'inbound' and vc.called_number = $2)
            or
            (vc.direction = 'outbound' and vc.caller_number = $2)
          )
        limit 1`,
      [parsed.data.voice_call_id, parsed.data.technical_phone_e164, ["telnyx", "asterisk"]],
    );
```

- [ ] **Step 4: Rodar o teste de novo, confirmar que passa.**

Run: `npx vitest run app/api/internal/voice/turn/route.test.ts`
Expected: PASS

- [ ] **Step 5: Rodar a suíte inteira de testes da rota de voz pra garantir que o caminho Telnyx
  não quebrou** (adicionar um segundo `it` no mesmo arquivo cobrindo `provider = 'telnyx'`
  continuando a funcionar, mesmo padrão do Step 2 trocando o mock).

Run: `npx vitest run app/api/internal/voice/turn/route.test.ts`
Expected: PASS (os dois casos)

- [ ] **Step 6: Commit**

```bash
git add app/api/internal/voice/turn/route.ts app/api/internal/voice/turn/route.test.ts
git commit -m "fix(voice): /api/internal/voice/turn aceita chamadas SIP/BYOC (asterisk), não só telnyx"
```

---

### Task 2: Endpoint `/stt` novo no sidecar Python (STT isolado, sem chat nem TTS)

O sidecar hoje só expõe `/turn` (STT + resposta OpenAI própria + TTS, tudo junto) e `/speak`
(TTS isolado, já existe, usado na saudação). Falta um STT isolado — sem isso, cada turno pagaria
uma chamada OpenAI e uma síntese de TTS que seriam descartadas, só pra extrair o texto ouvido.

Confirmado lendo o arquivo real na VPS (`/opt/voice-vps-bench/voice_worker_server_v12.py`,
`root@2.29.8.225`) nesta sessão — `local_transcribe(pcm_for_stt)` já existe e faz exatamente o
STT sozinho (faster-whisper), só falta expor num endpoint próprio.

**Files:**
- Modify (na VPS, fora do repo — `voice_worker_server_v12.py` não é versionado; deploy manual):
  adiciona um `elif` no `Handler.do_POST` e reaproveita `local_transcribe`/`ulaw2linear_vec` já
  existentes.

- [ ] **Step 1: Puxar a cópia atual do arquivo pro Mac local, pra editar com ferramenta normal**

```bash
scp -i ~/.ssh/id_ed25519 root@2.29.8.225:/opt/voice-vps-bench/voice_worker_server_v12.py /tmp/voice_worker_server_v12.py
```

- [ ] **Step 2: Adicionar o branch `/stt` no `do_POST`**, logo antes do `elif self.path ==
  '/speak':` existente (mesmo arquivo, `/tmp/voice_worker_server_v12.py`):

```python
            if self.path == '/turn':
                heard, reply_text, reply_ulaw = process_turn(body)
                self.send_response(200)
                import base64
                self.send_header('X-Heard', base64.b64encode(heard.encode('utf-8')).decode('ascii'))
                self.send_header('X-Reply-Text', base64.b64encode(reply_text.encode('utf-8')).decode('ascii'))
            elif self.path == '/stt':
                pcm = ulaw2linear_vec(body)
                text = local_transcribe(pcm)
                payload = text.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            elif self.path == '/speak':
```

  (`return` explícito no branch `/stt` porque a cauda comum do método (`self.send_header(
  'Content-Type', 'application/octet-stream')` etc.) é pra resposta binária ulaw dos outros
  branches — `/stt` responde texto plano, então sai antes de chegar nessa cauda.)

- [ ] **Step 3: Validar sintaticamente sem subir nada ainda**

```bash
python3 -m py_compile /tmp/voice_worker_server_v12.py
echo "exit=$?"
```

Expected: `exit=0`

- [ ] **Step 4: Copiar de volta pra VPS e reiniciar o processo**

```bash
scp -i ~/.ssh/id_ed25519 /tmp/voice_worker_server_v12.py root@2.29.8.225:/opt/voice-vps-bench/voice_worker_server_v12.py
ssh -i ~/.ssh/id_ed25519 root@2.29.8.225 "pkill -f voice_worker_server_v12.py; sleep 1; cd /opt/voice-vps-bench && setsid nohup env OPENAI_API_KEY=\$(grep -m1 '^export OPENAI_API_KEY=' /root/.bashrc | cut -d= -f2- | tr -d '\"') INWORLD_API_KEY=\$(grep -m1 '^export INWORLD_API_KEY=' /root/.bashrc | cut -d= -f2- | tr -d '\"') ./venv/bin/python3 voice_worker_server_v12.py > /tmp/worker_v12.log 2>&1 < /dev/null & disown; echo started"
```

- [ ] **Step 5: Provar que `/stt` responde de verdade** — gera 1s de µ-law silêncio (não precisa
  de fala real pra provar que o endpoint existe e não derruba o processo; teste com fala real
  acontece na Task 8, ligação de verdade):

```bash
ssh -i ~/.ssh/id_ed25519 root@2.29.8.225 "python3 -c \"import sys; sys.stdout.buffer.write(b'\\xff'*8000)\" | curl -s -X POST --data-binary @- http://127.0.0.1:8500/stt; echo; echo EXIT=\$?"
```

Expected: `EXIT=0`, resposta vazia ou texto curto (silêncio puro não gera transcrição, mas o
endpoint não pode devolver `500`/conexão recusada).

- [ ] **Step 6: Confirmar que `/turn` e `/speak` continuam funcionando** (regressão — o `elif`
  novo não pode ter quebrado a ordem dos branches existentes):

```bash
ssh -i ~/.ssh/id_ed25519 root@2.29.8.225 "printf 'teste' | curl -s -X POST --data-binary @- http://127.0.0.1:8500/speak -o /tmp/speak-test.ulaw -w 'HTTP=%{http_code} SIZE=%{size_download}\n'"
```

Expected: `HTTP=200`, `SIZE` > 0.

- [ ] **Step 7: Não há commit de código-fonte aqui** (sidecar fora do git) — registrar a mudança
  em `docs/current-state.md` §11 como feito, com o comando exato de deploy usado (Step 4) pra
  reprodutibilidade, já que não há histórico de git pra isso.

---

### Task 3: `lib/voice/media/rtp-frame.ts` — build/parse de pacote RTP

`RtpMediaSession.packets()` devolve datagramas UDP crus (header RTP de 12 bytes + payload µ-law);
`send()` espera um pacote já com header. Hoje nada no repo faz esse build/parse — só existe no
script Node solto da VPS (`buildRtpPacket` em `audio_bridge_v15.mjs`). Confirmado lendo os dois
arquivos nesta sessão.

**Files:**
- Create: `lib/voice/media/rtp-frame.ts`
- Test: `lib/voice/media/rtp-frame.test.ts`

**Interfaces:**
- Consumes: nada de outra task.
- Produces: `parseRtpPacket(packet: Buffer): { payload: Buffer } | null` (null se o pacote for
  curto demais pra ter header válido — mesma guarda `msg.length >= 12` do script provado).
  `createRtpPacketBuilder(): { build(payload: Buffer): Buffer }` — stateful (mantém `seq`/`ts`
  crescentes e um `ssrc` fixo por instância, mesmo padrão do script provado).

- [ ] **Step 1: Escrever o teste que falha primeiro**

```typescript
// lib/voice/media/rtp-frame.test.ts
import { describe, expect, it } from "vitest";
import { createRtpPacketBuilder, parseRtpPacket } from "./rtp-frame";

describe("parseRtpPacket", () => {
  it("descarta os 12 bytes de header e devolve só o payload", () => {
    const header = Buffer.alloc(12);
    header[0] = 0x80;
    const payload = Buffer.from([1, 2, 3, 4]);
    const packet = Buffer.concat([header, payload]);
    const result = parseRtpPacket(packet);
    expect(result).not.toBeNull();
    expect(result!.payload).toEqual(payload);
  });

  it("devolve null pra pacote menor que o header RTP (12 bytes)", () => {
    expect(parseRtpPacket(Buffer.alloc(8))).toBeNull();
  });
});

describe("createRtpPacketBuilder", () => {
  it("monta pacotes com seq/ts crescentes e o mesmo ssrc", () => {
    const builder = createRtpPacketBuilder();
    const payload = Buffer.alloc(160, 0xff);
    const p1 = builder.build(payload);
    const p2 = builder.build(payload);
    expect(p1.length).toBe(172); // 12 header + 160 payload
    const seq1 = p1.readUInt16BE(2);
    const seq2 = p2.readUInt16BE(2);
    expect(seq2).toBe((seq1 + 1) & 0xffff);
    const ts1 = p1.readUInt32BE(4);
    const ts2 = p2.readUInt32BE(4);
    expect(ts2).toBe((ts1 + 160) >>> 0);
    expect(p1.readUInt32BE(8)).toBe(p2.readUInt32BE(8)); // ssrc constante
    expect(p1.subarray(12)).toEqual(payload);
  });
});
```

- [ ] **Step 2: Rodar, confirmar que falha** (`rtp-frame.ts` não existe ainda).

Run: `npx vitest run lib/voice/media/rtp-frame.test.ts`
Expected: FAIL with "Cannot find module './rtp-frame'"

- [ ] **Step 3: Implementar**, porta direta do que já roda provado em
  `/opt/voice-vps-bench/audio_bridge_v15.mjs` (`buildRtpPacket`, constante `SSRC = 0xdeadbeef`):

```typescript
// lib/voice/media/rtp-frame.ts
/**
 * Build/parse mínimo de pacote RTP (RFC 3550) — só o suficiente pro par de
 * campos que o Asterisk ARI externalMedia usa (seq/ts/ssrc), payload
 * opaco (µ-law já vem codificado por quem chama). Porta de
 * `audio_bridge_v15.mjs` (buildRtpPacket), já provado numa ligação real.
 */
const RTP_HEADER_BYTES = 12;
const PAYLOAD_STEP = 160; // 20ms de µ-law a 8kHz, mesmo passo do script provado

export function parseRtpPacket(packet: Buffer): { payload: Buffer } | null {
  if (packet.length < RTP_HEADER_BYTES) return null;
  return { payload: packet.subarray(RTP_HEADER_BYTES) };
}

export interface RtpPacketBuilder {
  build(payload: Buffer): Buffer;
}

export function createRtpPacketBuilder(ssrc = 0xdeadbeef): RtpPacketBuilder {
  let seq = 0;
  let ts = 0;
  return {
    build(payload: Buffer): Buffer {
      const header = Buffer.alloc(RTP_HEADER_BYTES);
      header[0] = 0x80;
      header[1] = 0x00;
      header.writeUInt16BE(seq & 0xffff, 2);
      header.writeUInt32BE(ts >>> 0, 4);
      header.writeUInt32BE(ssrc, 8);
      seq += 1;
      ts += PAYLOAD_STEP;
      return Buffer.concat([header, payload]);
    },
  };
}
```

- [ ] **Step 4: Rodar de novo, confirmar que passa.**

Run: `npx vitest run lib/voice/media/rtp-frame.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/voice/media/rtp-frame.ts lib/voice/media/rtp-frame.test.ts
git commit -m "feat(voice): build/parse de pacote RTP, porta do script provado na VPS"
```

---

### Task 4: `lib/voice/media/continuous-sender.ts` — envio pareado a 20ms com silêncio

Sem isso, `send()` da bridge RTP manda pacotes em rajada (tudo de uma vez quando a resposta
chega) — causa raiz já documentada de um bug de jitter corrigido no script ad-hoc. O script
provado nunca para de mandar pacote a cada 20ms, mesmo sem áudio de resposta (manda silêncio).

**Files:**
- Create: `lib/voice/media/continuous-sender.ts`
- Test: `lib/voice/media/continuous-sender.test.ts`

**Interfaces:**
- Consumes: `RtpPacketBuilder` (Task 3, `lib/voice/media/rtp-frame.ts`), `RtpMediaSession.send`
  (já existe, `lib/voice/sip/rtp-media-bridge.ts`).
- Produces: `createContinuousSender(deps: { send: (packet: Buffer) => Promise<void>; builder:
  RtpPacketBuilder; frameBytes?: number; intervalMs?: number }): ContinuousSender` onde
  `ContinuousSender = { enqueue(payload: Buffer): void; stop(): void }`. `enqueue` fatia o áudio
  em frames de `frameBytes` (default 160) e empilha pra tocar; `stop()` para o timer (chamado no
  `StasisEnd`).

- [ ] **Step 1: Escrever o teste que falha primeiro**, usando fake timers pra provar a cadência
  sem esperar tempo real:

```typescript
// lib/voice/media/continuous-sender.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createContinuousSender } from "./continuous-sender";
import { createRtpPacketBuilder } from "./rtp-frame";

describe("createContinuousSender", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("manda silêncio a cada 20ms quando a fila está vazia", async () => {
    const sent: Buffer[] = [];
    const sender = createContinuousSender({
      send: async (packet) => { sent.push(packet); },
      builder: createRtpPacketBuilder(),
    });
    await vi.advanceTimersByTimeAsync(60);
    sender.stop();
    expect(sent.length).toBeGreaterThanOrEqual(3); // 60ms / 20ms
    // payload de silêncio = 0xff repetido (mesmo convenção do script provado, µ-law "silence byte")
    expect(sent[0]!.subarray(12).every((b) => b === 0xff)).toBe(true);
  });

  it("toca o áudio enfileirado frame a frame, volta pro silêncio quando acaba", async () => {
    const sent: Buffer[] = [];
    const sender = createContinuousSender({
      send: async (packet) => { sent.push(packet); },
      builder: createRtpPacketBuilder(),
      frameBytes: 4,
    });
    sender.enqueue(Buffer.from([1, 1, 1, 1, 2, 2, 2, 2])); // 2 frames de 4 bytes
    await vi.advanceTimersByTimeAsync(20); // 1º tick: frame 1
    await vi.advanceTimersByTimeAsync(20); // 2º tick: frame 2
    await vi.advanceTimersByTimeAsync(20); // 3º tick: volta a silêncio
    sender.stop();
    expect(sent[0]!.subarray(12)).toEqual(Buffer.from([1, 1, 1, 1]));
    expect(sent[1]!.subarray(12)).toEqual(Buffer.from([2, 2, 2, 2]));
    expect(sent[2]!.subarray(12).every((b) => b === 0xff)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar, confirmar que falha.**

Run: `npx vitest run lib/voice/media/continuous-sender.test.ts`
Expected: FAIL with "Cannot find module './continuous-sender'"

- [ ] **Step 3: Implementar**, porta de `startContinuousSender`/`queueReplyUlaw`/`SILENCE` de
  `audio_bridge_v15.mjs`:

```typescript
// lib/voice/media/continuous-sender.ts
import type { RtpPacketBuilder } from "./rtp-frame";

export interface ContinuousSender {
  enqueue(payload: Buffer): void;
  stop(): void;
}

export function createContinuousSender(deps: {
  send: (packet: Buffer) => Promise<void>;
  builder: RtpPacketBuilder;
  frameBytes?: number;
  intervalMs?: number;
}): ContinuousSender {
  const frameBytes = deps.frameBytes ?? 160;
  const intervalMs = deps.intervalMs ?? 20;
  const silence = Buffer.alloc(frameBytes, 0xff);
  let queue: Buffer[] = [];

  const timer = setInterval(() => {
    const frame = queue.length ? queue.shift()! : silence;
    // Fire-and-forget por design: o timer não pode travar esperando uma
    // rede lenta, senão perde a cadência de 20ms — mesma escolha do
    // script provado (udp.send com callback, não await no timer).
    deps.send(deps.builder.build(frame)).catch(() => undefined);
  }, intervalMs);

  return {
    enqueue(payload: Buffer): void {
      queue = [];
      for (let offset = 0; offset < payload.length; offset += frameBytes) {
        let frame = payload.subarray(offset, offset + frameBytes);
        if (frame.length < frameBytes) {
          const padded = Buffer.alloc(frameBytes, 0xff);
          frame.copy(padded);
          frame = padded;
        }
        queue.push(Buffer.from(frame));
      }
    },
    stop(): void {
      clearInterval(timer);
    },
  };
}
```

- [ ] **Step 4: Rodar de novo, confirmar que passa.**

Run: `npx vitest run lib/voice/media/continuous-sender.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/voice/media/continuous-sender.ts lib/voice/media/continuous-sender.test.ts
git commit -m "feat(voice): sender RTP contínuo a 20ms com silêncio, porta do script provado"
```

---

### Task 5: `lib/voice/media/sidecar-speech-adapter.ts` — implementa `StreamingSttPort`/`StreamingTtsPort`

**Files:**
- Create: `lib/voice/media/sidecar-speech-adapter.ts`
- Test: `lib/voice/media/sidecar-speech-adapter.test.ts`

**Interfaces:**
- Consumes: `StreamingSttPort`/`StreamingTtsPort`/`VoiceAudioFrame`/`VoiceSttEvent`/
  `VoiceTtsPlayback` (já existem, `lib/voice/runtime/stt-port.ts`/`tts-port.ts`); endpoint `/stt`
  (Task 2) e `/speak` (já existe) do sidecar.
- Produces: `createSidecarSpeechAdapter(config: { baseUrl: string; fetchImpl?: typeof fetch;
  timeoutMs?: number }): { stt: StreamingSttPort; tts: StreamingTtsPort }`.

- [ ] **Step 1: Escrever o teste que falha primeiro**, com um servidor HTTP fake local (não mock
  de `fetch` — o contrato real é HTTP puro, testar contra um servidor de verdade é mais barato e
  mais fiel que simular `Response`):

```typescript
// lib/voice/media/sidecar-speech-adapter.test.ts
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
```

- [ ] **Step 2: Rodar, confirmar que falha.**

Run: `npx vitest run lib/voice/media/sidecar-speech-adapter.test.ts`
Expected: FAIL with "Cannot find module './sidecar-speech-adapter'"

- [ ] **Step 3: Implementar**

```typescript
// lib/voice/media/sidecar-speech-adapter.ts
import type { StreamingSttPort, VoiceAudioFrame } from "../runtime/stt-port";
import type { StreamingTtsPort, VoiceTtsPlayback } from "../runtime/tts-port";

/**
 * Fala com o sidecar Python já provado numa ligação real
 * (voice_worker_server_v12.py na VPS) — modo LOTE, não streaming: 1
 * chamada HTTP por turno em cada porta. STT usa /stt (Task 2, endpoint
 * novo, isolado — sem chat nem TTS embutido); TTS usa /speak (já existia,
 * usado hoje na saudação proativa).
 */
export function createSidecarSpeechAdapter(config: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): { stt: StreamingSttPort; tts: StreamingTtsPort } {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 20_000;

  const stt: StreamingSttPort = {
    async *transcribe(frames, options) {
      const chunks: Uint8Array[] = [];
      for await (const f of frames) {
        if (options.signal.aborted) throw new Error("[voice] sidecar STT aborted");
        chunks.push(f.data);
      }
      const body = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const response = await fetchImpl(`${baseUrl}/stt`, {
        method: "POST",
        body,
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]),
      });
      if (!response.ok) {
        throw new Error(`[voice] sidecar /stt failed: http_${response.status}`);
      }
      const text = (await response.text()).trim();
      yield { type: "final", text, confidence: null };
    },
  };

  const tts: StreamingTtsPort = {
    async synthesize(text, options): Promise<VoiceTtsPlayback> {
      const response = await fetchImpl(`${baseUrl}/speak`, {
        method: "POST",
        body: text,
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]),
      });
      if (!response.ok) {
        throw new Error(`[voice] sidecar /speak failed: http_${response.status}`);
      }
      const audioBuffer = new Uint8Array(await response.arrayBuffer());
      const singleFrame: VoiceAudioFrame = {
        data: audioBuffer,
        encoding: "mulaw",
        sampleRateHz: 8000,
        channels: 1,
        timestampMs: 0,
      };
      let cancelled = false;
      // `audio` na interface VoiceTtsPlayback é um AsyncIterable (propriedade), não um método —
      // um gerador async *invocado* na hora (não uma função nomeada) devolve o objeto iterável
      // certo. Escrever `async *audio() {}` aqui seria um bug de tipo: `playback.audio` viraria
      // uma função, e `for await (const f of playback.audio)` no chamador quebraria.
      return {
        audio: (async function* () {
          if (cancelled) return;
          yield singleFrame;
        })(),
        async cancel() {
          cancelled = true;
        },
      };
    },
  };

  return { stt, tts };
}
```

- [ ] **Step 4: Rodar de novo, confirmar que passa.**

Run: `npx vitest run lib/voice/media/sidecar-speech-adapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/voice/media/sidecar-speech-adapter.ts lib/voice/media/sidecar-speech-adapter.test.ts
git commit -m "feat(voice): adapter StreamingSttPort/StreamingTtsPort pro sidecar Python provado"
```

---

### Task 6: `SipBrainClient.runTurn` — extensão pro cliente HTTP já existente

**Files:**
- Modify: `lib/voice/sip/brain-client.ts`
- Modify (teste existente): `lib/voice/sip/brain-client.test.ts`

**Interfaces:**
- Consumes: `POST /api/internal/voice/turn` (corrigido na Task 1).
- Produces: `SipBrainClient.runTurn(input: { voice_call_id: string; technical_phone_e164: string;
  transcript: string }): Promise<{ kind: "reply"; text: string } | { kind: "blocked"; reason:
  string }>`.

- [ ] **Step 1: Ler `lib/voice/sip/brain-client.test.ts` existente** pra copiar o padrão exato de
  teste (`fetchImpl` fake) já usado pra `resolveContext`/`recordEvent` — não inventar um novo.

- [ ] **Step 2: Escrever o teste que falha primeiro**, adicionando ao arquivo de teste existente:

```typescript
// acrescentar em lib/voice/sip/brain-client.test.ts
it("runTurn chama /api/internal/voice/turn e devolve o resultado", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: { kind: "reply", text: "oi, tudo bem?" } }), { status: 200 }),
  );
  const client = createSipVoiceBrainClient({ baseUrl: "https://crm.example.com", secret: "s3cret", fetchImpl });
  const result = await client.runTurn({
    voice_call_id: "00000000-0000-0000-0000-000000000001",
    technical_phone_e164: "+351210000000",
    transcript: "olá",
  });
  expect(result).toEqual({ kind: "reply", text: "oi, tudo bem?" });
  const [url] = fetchImpl.mock.calls[0]!;
  expect(url).toBe("https://crm.example.com/api/internal/voice/turn");
});
```

- [ ] **Step 3: Rodar, confirmar que falha** (`runTurn` não existe no client).

Run: `npx vitest run lib/voice/sip/brain-client.test.ts`
Expected: FAIL with "client.runTurn is not a function"

- [ ] **Step 4: Implementar**, mesmo padrão de `resolveContext`/`recordEvent` já no arquivo:

```typescript
// lib/voice/sip/brain-client.ts — adicionar ao tipo SipBrainClient e à implementação

// no interface SipBrainClient, adicionar:
  runTurn(input: {
    voice_call_id: string;
    technical_phone_e164: string;
    transcript: string;
  }): Promise<{ kind: "reply"; text: string } | { kind: "blocked"; reason: string }>;

// na implementação createSipVoiceBrainClient, dentro do objeto retornado, adicionar:
    runTurn(input) {
      return postJson(fetchImpl, `${baseUrl}/api/internal/voice/turn`, secret, input, timeoutMs);
    },
```

- [ ] **Step 5: Rodar de novo, confirmar que passa.**

Run: `npx vitest run lib/voice/sip/brain-client.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/voice/sip/brain-client.ts lib/voice/sip/brain-client.test.ts
git commit -m "feat(voice): SipBrainClient.runTurn chama /api/internal/voice/turn"
```

---

### Task 7: Ligar tudo em `workers/voice-sip-worker/main.mjs`

**Files:**
- Modify: `workers/voice-sip-worker/main.mjs`
- Modify: `workers/voice-sip-worker/main.smoke.mjs` (estender a prova de fumaça existente)

**Interfaces:**
- Consumes: `createAsteriskRtpMediaBridge` (já existe), `createSidecarSpeechAdapter` (Task 5),
  `createContinuousSender` (Task 4), `parseRtpPacket` (Task 3), `SipBrainClient.runTurn` (Task 6).
- Produces: nada consumido por task futura — é o ponto de integração final.

- [ ] **Step 1: Adicionar env vars novas ao cabeçalho de comentário e à leitura de env** —
  `VOICE_MEDIA_SIDECAR_URL` (obrigatória só quando mídia está habilitada; default
  `http://127.0.0.1:8500`, mesma porta já provada), `VOICE_MEDIA_LISTEN_MS` (default `4000`,
  mesmo valor provado), `VOICE_MEDIA_EXTERNAL_HOST` (obrigatória — IP/host que o Asterisk usa pra
  mandar RTP de volta, mesmo papel de `advertisedHost` em `createAsteriskRtpMediaBridge`).

```javascript
// workers/voice-sip-worker/main.mjs — no topo, junto dos outros imports
import { createAsteriskRtpMediaBridge } from "../../lib/voice/sip/rtp-media-bridge.ts";
import { createSidecarSpeechAdapter } from "../../lib/voice/media/sidecar-speech-adapter.ts";
import { createContinuousSender } from "../../lib/voice/media/continuous-sender.ts";
import { createRtpPacketBuilder, parseRtpPacket } from "../../lib/voice/media/rtp-frame.ts";

// dentro de createVoiceSipWorker, junto das outras leituras de env — mídia é OPCIONAL: um
// worker sem essas 3 env vars continua rodando só a sinalização, como hoje.
  const mediaEnabled = Boolean(env.VOICE_MEDIA_EXTERNAL_HOST);
  const mediaSidecarUrl = env.VOICE_MEDIA_SIDECAR_URL ?? "http://127.0.0.1:8500";
  const mediaListenMs = Number(env.VOICE_MEDIA_LISTEN_MS ?? "4000");
  const speech = mediaEnabled ? createSidecarSpeechAdapter({ baseUrl: mediaSidecarUrl }) : null;
  const rtpBridge = mediaEnabled
    ? createAsteriskRtpMediaBridge({ ari: connection, appName: ariAppName, advertisedHost: env.VOICE_MEDIA_EXTERNAL_HOST })
    : null;
```

- [ ] **Step 2: Adicionar a função que atende 1 chamada** (captura → STT → turn → TTS → fala,
  em loop até a chamada acabar), dentro de `createVoiceSipWorker`, antes de `run()`:

```javascript
  const activeMediaSessions = new Map(); // channelId -> { rtpSession, sender, stop }

  async function attachMedia(channelId, voiceCallId, technicalPhoneE164) {
    if (!mediaEnabled || activeMediaSessions.has(channelId)) return;
    const rtpSession = await rtpBridge.start({ callChannelId: channelId });
    const sender = createContinuousSender({
      send: (packet) => rtpSession.send(packet),
      builder: createRtpPacketBuilder(),
    });
    let stopped = false;
    activeMediaSessions.set(channelId, { rtpSession, sender });

    (async () => {
      while (!stopped) {
        const captured = [];
        const captureUntil = Date.now() + mediaListenMs;
        const iterator = rtpSession.packets()[Symbol.asyncIterator]();
        while (Date.now() < captureUntil && !stopped) {
          const remaining = captureUntil - Date.now();
          const result = await Promise.race([
            iterator.next(),
            new Promise((resolve) => setTimeout(() => resolve({ done: true, timedOut: true }), Math.max(remaining, 0))),
          ]);
          if (result.done) break;
          const parsed = parseRtpPacket(result.value);
          if (parsed) captured.push(parsed.payload);
        }
        if (stopped) break;
        if (captured.length === 0) continue;
        try {
          const controller = new AbortController();
          async function* asFrames() {
            for (const payload of captured) {
              yield { data: payload, encoding: "mulaw", sampleRateHz: 8000, channels: 1, timestampMs: 0 };
            }
          }
          let heardText = "";
          for await (const event of speech.stt.transcribe(asFrames(), { locale: "pt-PT", signal: controller.signal })) {
            if (event.type === "final") heardText = event.text;
          }
          if (!heardText.trim()) continue;
          const turnResult = await brainClient.runTurn({
            voice_call_id: voiceCallId,
            technical_phone_e164: technicalPhoneE164,
            transcript: heardText,
          });
          const replyText = turnResult.kind === "reply"
            ? turnResult.text
            : "Desculpe, não posso ajudar com isso agora.";
          const playback = await speech.tts.synthesize(replyText, { locale: "pt-PT", signal: controller.signal });
          for await (const frame of playback.audio) {
            sender.enqueue(Buffer.from(frame.data));
          }
        } catch (error) {
          // Mesma filosofia de disponibilidade do resto do worker: uma
          // falha de turno não pode derrubar a chamada nem o processo.
          //
          // Divergência CONSCIENTE da spec: o desenho original previa "cai
          // pra frase de apologia gravada" quando o sidecar está fora do
          // ar. Isso exigiria um asset de áudio local versionado no repo
          // (não depender do MESMO sidecar que acabou de falhar pra
          // sintetizar a desculpa) — fora do escopo desta task. Aqui, uma
          // falha de STT/turno/TTS vira SILÊNCIO só naquele turno (a
          // ligação continua, o próximo turno tenta de novo), não uma
          // frase falada. Se a Task 8 (ligação real) mostrar que isso é
          // uma UX ruim demais, é follow-up — não reabrir esta task pra
          // resolver sem medir primeiro.
          logError("voice_media_turn_failed", error, { channelId, voiceCallId });
        }
      }
    })().catch((error) => logError("voice_media_loop_crashed", error, { channelId }));

    return {
      async detach() {
        stopped = true;
        sender.stop();
        await rtpSession.close().catch(() => undefined);
        activeMediaSessions.delete(channelId);
      },
    };
  }
```

  Nota sobre o `Promise.race` no laço de captura: `rtpSession.packets()` é um iterável infinito
  (não fecha sozinho até `close()`), então captar por tempo fixo exige correr contra um timeout —
  não existe outro jeito de "pegar os próximos N ms de um iterável" sem isso.

- [ ] **Step 3: Ligar `attachMedia`/`detach` ao loop principal de eventos**, dentro do `for await
  (const result of listener.events())` já existente — depois do `forwarder.forward(result)`:

```javascript
      try {
        await forwarder.forward(result);
        processedEvents += 1;
        if (mediaEnabled && result.status === "normalized") {
          const { event } = result;
          const channelId = event.providerEventId; // asterisk-adapter.ts: providerEventId === channelId
          if (event.eventType === "StasisStart") {
            const technicalE164 = event.direction === "inbound" ? event.calledE164 : event.callerE164;
            const context = await brainClient.resolveContext({
              provider_call_id: event.providerEventId,
              connection_id: event.connectionId,
              caller_e164: event.callerE164,
              called_e164: event.calledE164,
              direction: event.direction,
            });
            await attachMedia(channelId, context.voice_call_id, technicalE164).catch((error) =>
              logError("voice_media_attach_failed", error, { channelId }),
            );
          } else if (event.eventType === "StasisEnd" || event.eventType === "ChannelHangupRequest") {
            const session = activeMediaSessions.get(channelId);
            if (session) await session.detach().catch((error) => logError("voice_media_detach_failed", error, { channelId }));
          }
        }
      } catch (error) {
```

  (`resolveContext` chamado de novo aqui é redundante com a chamada que `forwarder.forward` já
  fez por dentro — aceito, mesmo trade-off que o próprio `event-forwarder.ts` já documenta: "sem
  cache local pra não ter estado errado", 1 round-trip idempotente extra por chamada, não por
  turno.)

- [ ] **Step 4: Atualizar `stop()`** pra desligar todas as sessões de mídia ativas no shutdown:

```javascript
  async function stop(signal) {
    if (stopped) return;
    stopped = true;
    log("voice_sip_worker_shutdown", { signal });
    ready = false;
    for (const session of activeMediaSessions.values()) await session.detach().catch(() => undefined);
    if (listener) await listener.close();
    await new Promise((resolve) => healthServer.close(resolve));
    await pool.end();
  }
```

- [ ] **Step 5: Rodar o typecheck do repo inteiro** (esses arquivos `.mjs` importam `.ts` direto
  via `tsx`, então erro de tipo nos novos imports só aparece no `tsc`):

Run: `npx tsc --noEmit`
Expected: sem erro relacionado a `workers/voice-sip-worker/main.mjs` nem aos arquivos novos.

- [ ] **Step 6: Estender `main.smoke.mjs`** com um cenário de mídia — usar o mesmo padrão de ARI
  falso e Postgres nativo real já usado no arquivo, mais um servidor HTTP fake no lugar do
  sidecar (não o Python real — smoke test precisa ser hermético/reproduzível sem depender da VPS
  estar de pé). Ler `main.smoke.mjs` primeiro pra copiar o setup exato de `SUPABASE_DB_URL`/seed
  de schema já usado nele antes de escrever o cenário novo — não duplicar esse setup.

- [ ] **Step 7: Rodar o smoke test**

Run: `SUPABASE_DB_URL=<postgres nativo de teste> npx tsx workers/voice-sip-worker/main.smoke.mjs`
Expected: exit 0, incluindo o cenário de mídia novo.

- [ ] **Step 8: Commit**

```bash
git add workers/voice-sip-worker/main.mjs workers/voice-sip-worker/main.smoke.mjs
git commit -m "feat(voice): liga RTP+STT+Agent OS+TTS dentro do main.mjs real"
```

---

### Task 8: Prova de aceite — ligação telefônica real (manual, na VPS)

**Status em 2026-08-30: EM ANDAMENTO, não fechada.** Deploy real em produção feito e verificado;
worker real (`main.mjs`) subido apontado pra `https://crm.lumenva.pt` real. 4 bugs achados e
corrigidos um a um em ligações reais sucessivas (config `ARI_BASE_URL`, `voice_calls_provider_check`
sem `asterisk`, timestamp do Asterisk quebrando Zod `.datetime()` estrito). Um 4º bug ficou aberto
— `http_500` genuíno em `/context` ou `/event`, causa raiz não lida ainda — e a sessão parou aqui a
pedido explícito do dono ("Pare de alterar. Atualize toda a documentação."). **Nenhuma ligação até
agora produziu áudio.** Detalhe completo: `docs/current-state.md` §11 "Atualização 2026-08-30" e
memória `project_voice_core.md`. Retomar aqui na próxima sessão, não repetir os 4 fixes já feitos.

Não automatizável neste harness — é a mesma classe de prova que já validou a versão ad-hoc
(`docs/evidence/voice-vps-real-call-bridge-2026-08-28.md`), agora usando `main.mjs` real em vez
do script solto.

**Files:** nenhum (execução manual/registro de evidência).

- [ ] **Step 1:** Configurar `.env` do worker na VPS com `VOICE_MEDIA_EXTERNAL_HOST` (IP público
  da VPS), `VOICE_MEDIA_SIDECAR_URL=http://127.0.0.1:8500`, e as env vars já documentadas em
  `workers/voice-sip-worker/README.md`.

- [ ] **Step 2:** Subir `main.mjs` real (`npx tsx workers/voice-sip-worker/main.mjs`) apontado
  pro Asterisk real da VPS (porta 5060, instância já validada), não o `voicecore-test` de smoke.

- [ ] **Step 3:** Fazer uma ligação real (softphone/celular), falar uma pergunta, confirmar:
  áudio de resposta chega e faz sentido (não é eco/confirmação — é resposta do Agent OS real);
  `select * from voice_calls where id = ...` mostra a chamada `active`→`completed`;
  `select * from voice_call_events where voice_call_id = ...` mostra os eventos de lifecycle.

- [ ] **Step 4:** Medir a latência por turno (tempo entre parar de falar e a resposta começar) —
  comparar contra os ~5-8s do script ad-hoc; o Agent OS real adiciona 1 chamada de LLM com tools
  a mais no meio, então pode ficar mais lento — medir antes de declarar pronto, não assumir.

- [ ] **Step 5:** Registrar o resultado (latência medida, transcrição de exemplo, prints/logs)
  em `docs/evidence/voice-agent-os-real-call-YYYY-MM-DD.md`, e atualizar `docs/current-state.md`
  §11 com o veredito.

- [ ] **Step 6:** Parar o processo (`main.mjs`) ao fim do teste — não deixar rodando sem decisão
  explícita, mesmo padrão de disciplina já seguido nas sessões anteriores desta feature.
