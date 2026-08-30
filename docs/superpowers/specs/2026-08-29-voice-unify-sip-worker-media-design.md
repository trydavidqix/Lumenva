# Unificar o worker SIP com a mídia de voz provada (STT/TTS) — Design

> Spec de design. Depois de aprovada, a implementação é planejada via `writing-plans`.

## Contexto

Duas peças da voz por telefone existem hoje, provadas separadamente, nunca ligadas:

1. **Código mergeado no repo** (`codex/crm-consolidated`, merge de 2026-08-29): sinalização
   SIP/BYOC completa e testada (`workers/voice-sip-worker/main.mjs` — resolve tenant, grava
   eventos no CRM, reconecta sozinho), bridge RTP bidirecional real e testado
   (`lib/voice/sip/rtp-media-bridge.ts`), ponte real pro Agent OS (`lib/voice/runtime/
   turn-service.ts` — transcript entra, roda o agente de IA de verdade com tenant/tools, texto
   sai), e interfaces neutras de STT/TTS (`StreamingSttPort`/`StreamingTtsPort` em
   `lib/voice/runtime/stt-port.ts`/`tts-port.ts`) — desenhadas pra qualquer provider implementar,
   não amarradas a nenhum específico.
2. **Script ad-hoc fora do repo** (`voice_worker_server_v12.py`, `/opt/voice-vps-bench/` na VPS
   `lumenva-crm`): prova real de chamada telefônica ponta a ponta — softphone → Asterisk real →
   RTP → `faster-whisper` (STT) → resposta (hoje: OpenAI `gpt-5.6-luna` puro, sem Agent OS) →
   Inworld TTS → volta ao telefone. Funciona, testado ao vivo, mas não usa nada do código do
   repositório: sem tenant, sem RLS, sem audit, sem o agente de IA real do produto.

`lib/voice/pipecat/adapter.ts` — o único adapter concreto que existe hoje pras portas de
STT/TTS — é um scaffold vazio, documentado como tal no próprio arquivo ("this adapter does not
talk to a live Pipecat process yet"). O comentário original já previa que a implementação real de
`StreamingSttPort`/`StreamingTtsPort` viria via faster-whisper/Piper/Kokoro/OpenVoice diretamente
— nunca dependeu de o Pipecat funcionar. A tentativa de migrar pra Pipecat (`chan_websocket`) foi
pausada por um bug de áudio celular→servidor não resolvido depois de 3+ tentativas — não é
bloqueador desta unificação, que não usa Pipecat.

`workers/voice-sip-worker/main.mjs` hoje **não chama** `createAsteriskRtpMediaBridge` nem
`createVoiceTurnService` — zero fiação entre sinalização, mídia e Agent OS, apesar de cada peça
testada isoladamente. Essa fiação é o objeto desta spec.

## Objetivo

Fazer o `main.mjs` real (não um script solto) atender uma ligação telefônica de ponta a ponta:
Asterisk real → RTP → STT → **Agent OS real (com tenant/tools)** → TTS → RTP → telefone —
substituindo o texto fixo/OpenAI-puro do script ad-hoc pelo agente de IA de verdade do produto.

**Fora de escopo desta spec** (decisões já tomadas ou adiadas, não reabrir aqui):
- Migração pra Pipecat/`chan_websocket` — continua pausada.
- STT/TTS em streaming de verdade (texto parcial, áudio em pedaços) — ver "Decisão: modo lote".
- Ativar `VOICE_LIVE_ENABLED` em produção — depende desta unificação estar provada primeiro.
- Detecção real de fim de fala mais sofisticada que a já existente no script (fica como está).

## Decisão: modo lote, não streaming de verdade

`StreamingSttPort`/`StreamingTtsPort` são desenhadas pra streaming (partial transcripts, áudio em
chunks), mas o sidecar Python provado é turno completo (captura até silêncio → 1 chamada → 1
resposta). **Decisão: o adapter satisfaz a interface de streaming, mas por dentro faz 1 chamada
HTTP por turno e devolve um único evento final / um único bloco de áudio.** Reaproveita o pipeline
provado sem risco de reabrir os bugs de RTP/jitter já corrigidos a duras penas. Custo aceito: sem
barge-in real por enquanto (o módulo `lib/voice/runtime/barge-in.ts` existe mas fica sem uso real
nesta fase). Como a interface pública já é a de streaming, evoluir pra streaming de verdade depois
não exige mudar quem consome a porta — só a implementação por dentro dela.

## Decisão: mesmo processo, não worker novo

A fiação entra dentro de `workers/voice-sip-worker/main.mjs`, não um worker de mídia separado.
Motivos: o processo já tem o estado da chamada (tenant resolvido, `voice_call_id`, ciclo de vida
`StasisStart`/`StasisEnd`); a parte pesada (STT/TTS) já roda fora, no sidecar Python — o Node só
orquestra, não tem peso que justifique separar processo; menos partes móveis pra monitorar/reiniciar
na VPS. Separar processos fica como otimização futura, só se o volume real pedir.

## Componentes novos

- **`lib/voice/media/whisper-inworld-adapter.ts`** — implementa `StreamingSttPort` e
  `StreamingTtsPort`. Client HTTP fino pro sidecar Python: acumula frames até sinal de fim de
  turno, `POST` pro endpoint do sidecar, mapeia a resposta pro formato `VoiceSttEvent`/
  `VoiceTtsPlayback` das portas (um evento `final` só; um `AsyncIterable` de 1 frame de áudio só).
  Erro do sidecar (timeout, 5xx, conexão recusada) → propaga como falha da porta, tratado pelo
  chamador com fallback (ver "Erros" abaixo).
- **Extensão em `workers/voice-sip-worker/main.mjs`**: em `StasisStart`, quando a conexão SIP
  correspondente tem mídia habilitada, monta a sessão: `createAsteriskRtpMediaBridge` (áudio) +
  o novo adapter (STT/TTS) + `createVoiceTurnService` (Agent OS) + resolução do `voice_call_id`
  já existente no listener. Em `StasisEnd`/`ChannelHangupRequest`, desmonta a sessão (fecha o
  bridge, libera a porta UDP). Sessões concorrentes (múltiplas chamadas simultâneas) precisam
  estar isoladas por `voice_call_id` — sem estado global compartilhado entre chamadas.
- **Sidecar Python** (`voice_worker_server_v12.py`): sem reescrita de lógica — só formalizado
  como componente real do sistema (endpoint HTTP documentado/versionado), não mais só "bancada de
  teste" solta em `/opt/voice-vps-bench/`. Deploy/onde ele roda fica **fora do escopo desta spec**
  (é decisão operacional separada — hoje ele já roda na VPS de produção, ad-hoc).

## Fluxo de dados por chamada

```
StasisStart (Asterisk real)
  → RTP bridge abre socket UDP + canal externalMedia (ulaw, bidirecional)
  → frames de áudio acumulam até detectar silêncio (mesma lógica de captura do script atual)
  → POST pro sidecar Python (STT) → texto do usuário
  → createVoiceTurnService.run({ organizationId, contactId, voiceCallId, transcript })
      → Agent OS real: tenant resolvido, tools do agente, audit, tudo
  → texto de resposta do agente
  → POST pro sidecar Python (TTS) → áudio ulaw
  → áudio volta pelo RTP bridge pro telefone
  → repete até StasisEnd/ChannelHangupRequest
```

## Erros

- Sidecar Python fora do ar (timeout/conexão recusada) → sessão cai pra frase de apologia gravada
  (mesmo fallback que já existe no script atual), não silêncio morto.
- `turn-service.run()` retorna `blocked` (delivery não autorizada, agente não resolvido) → mesma
  mensagem genérica de erro técnico falada ao usuário.
- Nenhuma falha de uma chamada derruba o processo `main.mjs` inteiro nem afeta outras chamadas em
  andamento — mesmo padrão que `event-forwarder.ts` já usa (loga e segue, não propaga).
- Falha ao desmontar a sessão em `StasisEnd` (ex: bridge não fecha limpo) é logada, mas não trava
  o processo — o worker precisa sobreviver a chamadas anteriores mal encerradas.

## Teste

- Smoke test real (mesmo padrão de `main.smoke.mjs`) rodando contra ARI falso local + o sidecar
  Python real (não mock) — é justamente o componente que mais queremos provar de verdade, não
  fingir.
- Testes unitários do novo adapter (`whisper-inworld-adapter.test.ts`) cobrindo: turno completo
  feliz, timeout do sidecar → fallback, resposta malformada → erro tratado.
- **Prova final de aceite**: uma ligação telefônica real de ponta a ponta usando `main.mjs` (não
  mais o script solto) — mesmo tipo de prova que já validou a versão ad-hoc, mas agora passando
  pelo Agent OS real e pelo `voice_calls`/`voice_call_events` do banco.

## Riscos conhecidos, aceitos nesta fase

- Sem barge-in real (aceito, ver "Decisão: modo lote").
- Latência por turno provavelmente similar à do script ad-hoc (~5-8s antes das otimizações de
  Inworld; não medido ainda com o Agent OS real no meio, que adiciona uma chamada de LLM extra
  com tools — pode ficar mais lento). Medir na prova final antes de declarar pronto.
- Sidecar Python continua fora do controle de versão/deploy formal do repositório — dívida
  operacional já conhecida, não resolvida por esta spec.
