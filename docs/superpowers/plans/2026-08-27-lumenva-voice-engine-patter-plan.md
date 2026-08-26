# Lumenva Voice Engine (Patter-based) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o núcleo de ligação existente para um `Lumenva Voice Engine` controlado pelo CRM, reaproveitando seletivamente o Patter open-source para mídia/voz/telefonia sem criar um segundo Agent OS nem prender o produto à API pública do Patter.

**Architecture:** O CRM define uma interface própria `VoiceEngine`; a primeira implementação usa componentes/ideias do Patter sob licença MIT, atrás de adapters nossos. Telnyx continua sendo o carrier PSTN; Patter não recebe autoridade sobre identidade, Customer Memory, routing, LLM, tools, políticas ou handoff de negócio. LiveKit sai do caminho obrigatório e fica como adapter opcional exclusivamente para atendimento humano no navegador, caso esse modo seja ativado depois.

**Tech Stack:** Next.js 16.3, React 19, TypeScript 6, Supabase/Postgres/RLS, Agent OS existente, Customer Memory, Model Router canônico, Telnyx, Patter OSS (MIT, integração seletiva), STT/TTS provider-neutral; LiveKit opcional.

**Spec:** `docs/superpowers/plans/2026-08-26-nucleo-ligacao-integration-plan.md`

## Global Constraints

- Trabalhar somente na branch isolada `implementacao-tokens-voice-core`; não alterar `main`.
- Não criar `Voice Agent`, `Sales Voice Agent` ou runtime LLM paralelo.
- Patter é implementação interna/substituível do `VoiceEngine`, nunca fonte de verdade do CRM.
- Não entregar tools do CRM diretamente ao Patter; toda ação de negócio passa pelo Agent OS -> Operador -> Tool Gateway.
- Não entregar seleção de LLM ao Patter; todo raciocínio continua pelo Model Router canônico/free-first.
- Organização é resolvida pelo número técnico Telnyx antes do Caller ID; telefone nunca é pesquisado globalmente.
- Preservar contratos, persistência, state machine, Telnyx security, Caller ID e Customer Memory já implementados quando forem compatíveis.
- Não copiar código do Patter sem preservar notices/licença MIT aplicáveis; preferir dependência/adapters quando isso mantiver a fronteira substituível.
- Gravação/transcrição permanecem opt-in por tenant e sujeitas às políticas existentes.
- LiveKit não é dependência obrigatória do caminho IA <-> cliente.

---

## Arquitetura alvo

```text
CLIENTE
  |
 PSTN
  |
TELNYX
  |
  v
LUMENVA VOICE ENGINE
  |-- CarrierAdapter (Telnyx)
  |-- MediaPipeline (Patter-backed)
  |-- VAD / barge-in
  |-- STT
  |-- TTS
  |-- transfer transport
  |-- recording transport
  `-- voice metrics
  |
  v
VOICE AGENT BRIDGE
  |
  +--> tenant identity
  +--> Caller ID
  +--> Customer Memory
  +--> Intent Router / Agent OS
  +--> Model Router free-first
  +--> Operador / Tool Gateway
  +--> Policies / approvals
  `--> Human Handoff

LiveKit (opcional) -> somente Browser Human Adapter
```

## File map

- `lib/voice/engine/contracts.ts`: contrato proprietário e estável do Lumenva Voice Engine.
- `lib/voice/engine/factory.ts`: seleciona implementação do engine sem vazar Patter para consumidores.
- `lib/voice/patter/adapter.ts`: traduz contrato Lumenva <-> runtime Patter.
- `lib/voice/patter/media.ts`: configuração de VAD/STT/TTS/barge-in e cancelamento.
- `lib/voice/patter/telemetry.ts`: normaliza métricas de provider em eventos Lumenva.
- `lib/voice/runtime/agent-os-adapter.ts`: bridge texto/turno para o Agent OS existente.
- `lib/voice/transfer/adapter.ts`: coordena transferência telefônica com handoff de negócio existente.
- `lib/voice/livekit/**`: permanece opcional e não participa do fluxo default da IA.
- `lib/voice/telnyx/**`: mantém assinatura, replay protection, normalização e tenant resolution já construídos.
- `lib/voice/identity/**`: mantém Caller ID tenant-scoped já construído.

---

### Task 1: Congelar baseline e classificar código existente

**Files:**
- Create: `docs/evidence/implementacao-tokens/voice-core/patter-adoption-baseline.md`
- Read/verify: `lib/voice/**`

**Interfaces:**
- Consumes: Voice Core atual.
- Produces: matriz `KEEP | ADAPT | REPLACE | OPTIONAL` usada pelas Tasks 2–10.

- [ ] Registrar SHA inicial da branch e listar testes Voice Core existentes.
- [ ] Classificar `contracts`, `repository`, `config`, `telnyx`, `identity` como `KEEP` salvo incompatibilidade demonstrada por teste.
- [ ] Classificar `runtime/stt-port`, `runtime/tts-port`, `runtime/barge-in` e media orchestration como `ADAPT/REPLACE` somente após equivalência com Patter.
- [ ] Classificar `livekit` como `OPTIONAL`, sem deletar código nesta task.
- [ ] Registrar licença/versão/commit do Patter usado na avaliação.
- [ ] Rodar baseline: `pnpm typecheck` e testes `lib/voice/**/*.test.ts`.
- [ ] Commitar somente evidência; nenhum comportamento muda.

### Task 2: Criar a fronteira proprietária `VoiceEngine`

**Files:**
- Create: `lib/voice/engine/contracts.ts`
- Create: `lib/voice/engine/contracts.test.ts`

**Interfaces:**
- Produces:
  - `VoiceEngine.startSession(input): Promise<VoiceEngineSession>`
  - `VoiceEngineSession.events(): AsyncIterable<VoiceEngineEvent>`
  - `VoiceEngineSession.speak(text, options): Promise<void>`
  - `VoiceEngineSession.interrupt(): Promise<void>`
  - `VoiceEngineSession.transfer(target): Promise<VoiceTransferResult>`
  - `VoiceEngineSession.end(reason): Promise<void>`

- [ ] RED: teste prova que consumidores dependem apenas de `VoiceEngine`, nunca de tipos Patter.
- [ ] Definir eventos normalizados `speech_started | partial_transcript | final_transcript | playback_started | playback_finished | interrupted | transfer_state | ended | provider_error`.
- [ ] Exigir `organizationId`, `voiceCallId`, `direction` e locale na criação; `contactId` permanece nullable até Caller ID.
- [ ] Nenhum tipo do contrato pode importar `patter`, `livekit` ou SDK Telnyx.
- [ ] GREEN + `pnpm typecheck`.
- [ ] Commit.

### Task 3: Adapter Patter substituível

**Files:**
- Create: `lib/voice/patter/adapter.ts`
- Create: `lib/voice/patter/adapter.test.ts`
- Create: `lib/voice/engine/factory.ts`
- Create: `lib/voice/engine/factory.test.ts`

**Interfaces:**
- Consumes: `VoiceEngine` da Task 2.
- Produces: `createPatterVoiceEngine(deps)` e `createVoiceEngine(config, deps)`.

- [ ] RED: factory deve conseguir trocar implementação sem mudar Agent OS/Caller ID.
- [ ] Encapsular toda referência ao Patter dentro de `lib/voice/patter/**`.
- [ ] Traduzir lifecycle/eventos Patter para `VoiceEngineEvent`.
- [ ] Não configurar LLM/tools do Patter; o adapter expõe somente media/telephony callbacks necessários.
- [ ] Erro de inicialização do Patter deve produzir erro normalizado e não iniciar chamada parcialmente persistida.
- [ ] GREEN + typecheck.
- [ ] Commit.

### Task 4: Media pipeline Patter-backed

**Files:**
- Create: `lib/voice/patter/media.ts`
- Create: `lib/voice/patter/media.test.ts`
- Modify only if needed: `lib/voice/runtime/stt-port.ts`, `tts-port.ts`, `barge-in.ts`.

**Interfaces:**
- Consumes: áudio do carrier via engine.
- Produces: transcripts e playback através dos eventos/ações do `VoiceEngine`.

- [ ] RED: cliente interrompendo TTS deve cancelar playback antes de aceitar novo turno final.
- [ ] Configurar VAD, STT e TTS por config tenant sem hardcode de provider no Agent OS.
- [ ] Preservar codec/sample-rate explícitos dos contratos atuais.
- [ ] Preservar confidence de STT para confirmações de número/morada/valor/data.
- [ ] Medir `speech_end -> final_transcript`, `tts_request -> first_audio` e interruption latency.
- [ ] Comparar comportamento com testes existentes antes de aposentar qualquer runtime próprio.
- [ ] GREEN + regressões `lib/voice/runtime/*.test.ts`.
- [ ] Commit.

### Task 5: Voice Agent Bridge -> Agent OS canônico

**Files:**
- Create: `lib/voice/runtime/agent-os-adapter.ts`
- Create: `lib/voice/runtime/agent-os-adapter.test.ts`
- Modify minimally: seam de delivery/policy do Agent OS necessário para canal voz.

**Interfaces:**
- Consumes: `final_transcript`, `VoiceCallContext`, Caller ID e Customer Memory.
- Produces: texto aprovado para `VoiceEngineSession.speak()`.

- [ ] RED: provar que voice bridge não chama OpenAI/Anthropic/Gemini/Patter LLM diretamente.
- [ ] Extrair do Agent OS somente o acoplamento de entrega que hoje presume `channel_sessions` de mensageria; não criar sessão WhatsApp falsa.
- [ ] Reutilizar Intent Router, agente publicado, Customer Memory, Model Router, tools e políticas existentes.
- [ ] Patter recebe somente a resposta final aprovada para TTS.
- [ ] Mesmo cliente/agente deve manter identidade lógica entre WhatsApp e voz.
- [ ] GREEN + regressões Agent OS + WhatsApp.
- [ ] Commit.

### Task 6: Telnyx -> Lumenva Voice Engine

**Files:**
- Modify: `lib/voice/telnyx/**`
- Create/modify: `app/api/v1/webhooks/telnyx/**`
- Test: `lib/voice/telnyx/**/*.test.ts`

**Interfaces:**
- Consumes: webhook Telnyx validado.
- Produces: sessão `VoiceEngine` tenant-scoped.

- [ ] Preservar Ed25519, anti-replay, idempotência e evento normalizado existentes.
- [ ] Resolver número técnico -> `organizationId` antes de Caller ID.
- [ ] Resolver Caller ID dentro da organização e hidratar memória compacta quando conhecido.
- [ ] Inbound inicia `VoiceEngine` sem LiveKit obrigatório.
- [ ] Outbound continua governado por UI/Tool Gateway; nenhum endpoint público arbitrário de discagem.
- [ ] Testar mesmo E.164 em dois tenants.
- [ ] GREEN + tenant lint.
- [ ] Commit.

### Task 7: Transferência humana em duas fases

**Files:**
- Implement/modify: `lib/voice/transfer/adapter.ts`
- Test: `lib/voice/transfer/adapter.test.ts`

**Interfaces:**
- Consumes: `VoiceEngineSession.transfer()` + human handoff/cases existente.
- Produces: takeover confirmado e estado de negócio consistente.

- [ ] RED: falha da ponte não pode silenciar IA nem abrir handoff como concluído.
- [ ] Fase 1: Voice Engine tenta conectar destino humano.
- [ ] Fase 2: somente após confirmação, chamar handoff/case existente e silenciar IA.
- [ ] Falha/timeout retorna ao agente de voz ou fallback configurado; nunca silêncio indefinido.
- [ ] Persistir motivo, resumo, ação pendente e linkage call/contact/conversation.
- [ ] GREEN.
- [ ] Commit.

### Task 8: Tornar LiveKit explicitamente opcional

**Files:**
- Modify: `lib/voice/livekit/**` somente para mover atrás de interface opcional.
- Create: `lib/voice/human-browser/adapter.ts` se o código existente exigir fronteira explícita.
- Test: `lib/voice/human-browser/adapter.test.ts`.

**Interfaces:**
- Produces: `BrowserHumanVoiceAdapter` opcional.

- [ ] RED: fluxo IA inbound/outbound deve funcionar em teste sem importar LiveKit.
- [ ] Remover LiveKit do caminho obrigatório do `VoiceEngine` default.
- [ ] Preservar código LiveKit útil para futuro takeover humano no browser.
- [ ] Nenhuma credencial LiveKit é necessária quando browser-human mode está OFF.
- [ ] GREEN + build.
- [ ] Commit.

### Task 9: Recording, métricas e observabilidade normalizadas

**Files:**
- Create: `lib/voice/patter/telemetry.ts`
- Create: `lib/voice/patter/telemetry.test.ts`
- Extend: observability existente.

**Interfaces:**
- Consumes: métricas/events Patter e Telnyx.
- Produces: métricas Lumenva provider-neutral.

- [ ] Normalizar `carrier_ms`, `stt_ms`, `agent_ms`, `tts_ms`, `e2e_ms`, interruption latency e custos disponíveis.
- [ ] Não persistir payload bruto do Patter por padrão.
- [ ] Redigir números/PII em logs; transcript segue política tenant.
- [ ] Recording somente quando config explícita permitir.
- [ ] Correlacionar `voice_call_id -> carrier event -> engine session -> Agent OS run -> tool -> outcome`.
- [ ] GREEN.
- [ ] Commit.

### Task 10: Painel `Agente de Ligação` sobre o novo engine

**Files:**
- Create/modify: `app/app/ai/voice/**`
- Create/modify: `components/voice/**`
- Modify: `lib/navigation/registry.ts`
- Test: component/E2E/mobile.

**Interfaces:**
- Consumes: estado provider-neutral do Lumenva Voice Engine.
- Produces: central operacional aprovada; não expõe Patter como conceito ao tenant.

- [ ] Mostrar chamadas ativas/fila/duração/cliente/agente/custo/latência/handoff.
- [ ] Controles `mute/hold/transfer/end` permission-gated e traduzidos para `VoiceEngine`, não Patter diretamente.
- [ ] Mostrar Customer Memory e fatos autoritativos separados de inferências.
- [ ] Histórico/transcript respeita config de privacidade.
- [ ] Mobile 390x844 sem sidebar fixa consumindo viewport operacional.
- [ ] Estados loading/empty/error/provider-degraded.
- [ ] E2E + accessibility + build.
- [ ] Commit.

### Task 11: Equivalência funcional e remoção segura de duplicação

**Files:**
- Modify/delete: somente arquivos Voice Runtime comprovadamente substituídos.
- Create: `docs/evidence/implementacao-tokens/voice-core/patter-equivalence.md`

**Interfaces:**
- Produces: decisão auditável por componente.

- [ ] Para cada item `ADAPT/REPLACE` da Task 1, demonstrar teste equivalente antes de remover implementação própria.
- [ ] Não remover `contracts`, repository, tenant identity, Customer Memory, Agent OS bridge, Telnyx security ou handoff de negócio.
- [ ] Remover apenas duplicações de media/VAD/STT/TTS/barge-in comprovadamente cobertas.
- [ ] Registrar componentes Patter incorporados/dependências e notices MIT.
- [ ] Rodar regressão completa Voice + WhatsApp.
- [ ] Commit.

### Task 12: Gate E2E e evidências finais

**Files:**
- Create: `docs/evidence/implementacao-tokens/voice-core/lumenva-voice-engine-final.md`
- Extend: evals/fixtures de voz.

**Interfaces:**
- Produces: evidência de conclusão do novo Plano 1.

- [ ] E2E inbound: Telnyx -> tenant -> Caller ID -> VoiceEngine -> Agent OS -> TTS -> cliente.
- [ ] E2E outbound governado: Tool/UI -> VoiceEngine -> Telnyx -> cliente.
- [ ] Evals: áudio ruim, barge-in, STT low-confidence, prompt injection falada, tenant collision, provider disconnect, transfer failure, recording OFF.
- [ ] Provar que Patter não recebe tools/LLM authority nem dados cross-tenant.
- [ ] Provar que LiveKit não é necessário para chamada IA normal.
- [ ] Provar que WhatsApp e voz compartilham Agent OS e Customer Memory sem histórico bruto automático.
- [ ] Rodar `pnpm typecheck`, testes unitários Voice/Agent OS/WhatsApp, tenant lint e `pnpm next build` no SHA final.
- [ ] Registrar versões, SHA, resultados, latências/custos e limitações externas restantes.
- [ ] Não mergear para `main`.
- [ ] Commit.

---

## Definition of Done

O `Lumenva Voice Engine` está concluído quando chamadas inbound e outbound governadas usam Telnyx + uma implementação Patter-backed atrás da interface proprietária `VoiceEngine`, conversam com o Agent OS canônico através do `Voice Agent Bridge`, compartilham Customer Memory e tools com WhatsApp, suportam interrupção e transferência segura, registram observabilidade provider-neutral e não exigem LiveKit para o caminho normal de IA. Patter pode ser trocado no futuro sem alterar Agent OS, CRM, identidade, memória, tools ou UI operacional.

## Relação com o plano anterior

Este documento **substitui a arquitetura de execução das Tasks 4–7 e 9 do plano** `2026-08-26-nucleo-ligacao-integration-plan.md`, especificamente onde aquele plano tornava LiveKit obrigatório e previa media runtime próprio. Tasks já implementadas de contratos, persistência, tenant config, Telnyx security e Caller ID são preservadas e passam pelo gate de equivalência; nada é descartado sem teste.

O plano mestre `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md` continua sendo o panorama maior do CRM.
