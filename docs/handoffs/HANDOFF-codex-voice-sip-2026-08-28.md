# HANDOFF pro Codex — Voice Core SIP/BYOC (sessão Claude 2026-08-28)

> **ERRATA 2026-08-28 — ler antes do restante deste arquivo.** Este handoff foi escrito antes
> do teste na VPS e contém frases históricas que dizem que não havia Asterisk real acessível.
> Isso ficou superado. A bridge foi ligada parcialmente ao Asterisk real da VPS, o worker rodou
> como serviço de teste e `/healthz` respondeu. O estado consolidado e a lista correta de tarefas
> estão em `docs/handoffs/HANDOFF-voice-sip-2026-08-28.md` e em
> `docs/current-state-voice-core.md`. Não repetir a configuração do Asterisk/ARI/worker.

**Branch:** `implementacao-tokens-voice-core` (única branch alterada nesta sessão — `main` não foi tocada)
**Commits desta sessão:** `8f888ccd` → `10b7a0e8` (13 commits, listados abaixo)
**Não mergear pra `main` sem autorização explícita do dono do repo.**

Este documento é o resumo cronológico e técnico de tudo que uma sessão Claude fez nesta branch
em 2026-08-28, pra dar contexto suficiente a outro agente (Codex) continuar sem re-descobrir
nada. Para o histórico completo com raciocínio detalhado por fatia, ver
`docs/handoffs/HANDOFF-voice-core.md` (mais longo, mesmo conteúdo em mais profundidade) e
`docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` (seção "Progresso").

---

## Contexto: o que já existia antes desta sessão

O Voice Core tem duas arquiteturas coexistindo na mesma branch:

1. **Telnyx/Deepgram/ElevenLabs** — a que roda em produção hoje (`workers/voice-worker/**`). Não
   foi tocada nesta sessão.
2. **SIP/BYOC open-source** (Asterisk/ARI + futuramente Pipecat/faster-whisper/Piper/Kokoro) — um
   plano aprovado pelo dono do repo (`docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md`).
   Antes desta sessão, as Fases 1-6 desse plano já tinham sido implementadas por sessões
   anteriores: contratos (`VoiceEngine`, `SipGateway`), adapter Asterisk (`lib/voice/sip/asterisk-adapter.ts`),
   resolução de tenant por conexão (`lib/voice/identity/resolve-organization.ts`), adapters
   STT/TTS/clone open-source, migration `voice_sip_connections`. **Nada disso estava ligado a um
   processo real** — só existiam como módulos TypeScript testados com mocks.

## O que esta sessão fez: 8 fatias de código + ajustes de doc, todas testadas e verificadas

Cada fatia foi commitada e verificada com `bash scripts/verify-voice-core.sh` antes de avançar
pra próxima. Ordem cronológica:

### 1. Cliente ARI real — commit `8f888ccd`
- **Novo:** `lib/voice/sip/asterisk-ari-client.ts` (`createAsteriskAriConnection`) — cliente
  HTTP+WebSocket real do protocolo ARI do Asterisk (`POST /ari/channels`, `.../answer`, `DELETE
  /ari/channels/{id}`, `ws://.../ari/events`). Implementa a interface `AriClient` já existente em
  `asterisk-adapter.ts` (não alterada) e estende com `AriConnection`/`AriEventStream`.
- **Novo:** `lib/voice/sip/asterisk-ari-client.test.ts` — 8 testes contra um servidor ARI falso
  real local (HTTP+WS reais, não `vi.fn()`).
- **Novo:** `workers/voice-sip-worker/` (diretório inteiro criado) — `ari-listener.smoke.mjs`
  (smoke test executável via `npx tsx`) e `README.md`.
- **Dependência nova:** `ws` (só como `devDependency`, usada pro servidor WS falso nos
  testes/smoke — o cliente de produção usa o `WebSocket` global do Node 22, sem dependência
  nova).

### 2. Mais tipos de evento ARI — commit `eb0abcc0`
- **Alterado:** `lib/voice/sip/asterisk-adapter.ts#parseInboundEvent` — reconhecia só
  `StasisStart`; agora também `StasisEnd` e `ChannelHangupRequest` (as duas formas do Asterisk
  sinalizar fim de chamada). Mesma validação de tenant nos três. Campo `eventType` retornado
  passou a carregar o tipo real em vez de `"StasisStart"` fixo.
- **Alterado:** `lib/voice/sip/asterisk-adapter.test.ts` — 2 testes novos.

### 3. Listener ligado ao resolver de tenant real — commit `cecdf0e1`
- **Novo:** `lib/voice/sip/asterisk-listener.ts` (`createAsteriskAriListener`) — consome o
  stream de eventos do `AriConnection`, alimenta cada um em `SipGateway.parseInboundEvent`, e
  produz `{status: "normalized", event}` ou `{status: "rejected", error, raw}` **sem nunca
  derrubar o loop** (um evento ruim não pode matar o processo).
- **Novo:** `lib/voice/sip/asterisk-listener.test.ts` — testado com
  `createVoiceOrganizationResolver` **de verdade** (não mock), contra banco falso em memória.
- **Novo:** `lib/voice/sip/testing/fake-ari-server.ts` — helper de servidor ARI falso extraído
  (compartilhado entre `asterisk-ari-client.test.ts` e `asterisk-listener.test.ts`).
- **Alterado:** `ari-listener.smoke.mjs` estendido.

### 4. Reconexão automática — commit `c71748fd`
- **Alterado:** `lib/voice/sip/asterisk-listener.ts` — reconecta sozinho com backoff exponencial
  (sem teto de tentativas) quando o WebSocket cai sem `close()` explícito. Opções `reconnectDelayMs`,
  `maxReconnectDelayMs`, `wait` (injetável pra testes).
- **Alterado:** `fake-ari-server.ts` ganhou `dropConnection()` (`socket.terminate()`, queda
  forçada de verdade, não fechamento limpo simulado).
- Testes rodados 5x seguidas pra descartar flakiness de timing.

### 5. Rota `/event` aceita SIP/BYOC — commit `2eb7a8d4` (**decisão do dono do repo**: estender
   a rota existente em vez de criar uma nova)
- **Alterado:** `app/api/internal/voice/event/route.ts` — aceita `connection_id`+`phone_e164`
  como alternativa a `technical_phone_e164` (Telnyx). `.superRefine()` garante exatamente um dos
  dois. Novo caminho faz join `voice_sip_connections`→`voice_phone_numbers`; `organization_id`
  nunca vem do corpo em nenhum dos dois caminhos.
- **Novo:** `app/api/internal/voice/event/route.test.ts` — 7 testes (padrão de mock de
  `getRequestPool`, igual outras rotas do repo).

### 6. Rota `/context` aceita SIP/BYOC — commit `84f395b5` (mesma decisão)
- **Alterado:** `app/api/internal/voice/context/route.ts` — aceita `connection_id` opcional.
  Função nova `resolveSipContext()` no próprio arquivo (não mexeu em
  `lib/voice/runtime/context-service.ts`, que é Telnyx-tipado e continua servindo só o caminho
  antigo via `resolveTelnyxContext()`, também extraída). Cria `voice_calls` com
  `provider='asterisk'`.
- **Novo:** `app/api/internal/voice/context/route.test.ts` — 6 testes.
- **Com isso, `/context`+`/event` formam um contrato HTTP coerente ponta a ponta pro mundo SIP.**

### 7. Cliente HTTP + forwarder — commit `00c44c48`
- **Novo:** `lib/voice/sip/brain-client.ts` (`createSipVoiceBrainClient`) — cliente HTTP real
  (`resolveContext`/`recordEvent`), irmão TypeScript de `workers/voice-worker/brain-client.mjs`.
- **Novo:** `lib/voice/sip/event-forwarder.ts` (`createSipEventForwarder`) — pega um evento
  normalizado do listener, mapeia `StasisStart→active`, `StasisEnd`/`ChannelHangupRequest→completed`,
  chama `resolveContext` (idempotente, sem cache local) e depois `recordEvent`.
- **Novo:** `brain-client.test.ts` (servidor HTTP real) e `event-forwarder.test.ts` (mapeamento).
- **Alterado:** `ari-listener.smoke.mjs` — agora sobe também um CRM falso e prova o pipeline
  inteiro (Asterisk falso → listener → forwarder → CRM falso) com os dois eventos do mesmo canal
  resolvendo o **mesmo** `voice_call_id`.

### 8. Entrypoint de produção real — commit `b46ea128` (**decisão de build tomada: `tsx` direto**)
- **Novo:** `workers/voice-sip-worker/main.mjs` (`createVoiceSipWorker`) — processo de longa
  duração de verdade. Lê env vars (ver lista abaixo), monta
  ARI→gateway→listener→forwarder, expõe `GET /healthz`, nunca derruba o loop numa falha de
  encaminhamento, desliga gracioso em `SIGTERM`/`SIGINT`.
- **Decisão explícita, documentada no cabeçalho do arquivo**: diferente do worker Telnyx ("no
  database credentials"), este processo lê Postgres direto (`createVoiceOrganizationResolver` via
  `createPool` — não `pg.Pool` cru, que não teria o listener de erro por-cliente que este repo já
  documentou como pitfall real) pra validar a conexão SIP localmente antes de qualquer chamada de
  rede. Não existe endpoint HTTP leve só pra esse check hoje — **fica marcado como ponto a
  revisar**, não resolvido silenciosamente.
- **Novo:** `workers/voice-sip-worker/main.smoke.mjs` — prova `main.mjs` real de ponta a ponta
  contra **Postgres nativo real** (não fake!) + Asterisk falso + CRM falso. Semeia schema mínimo
  (`voice_sip_connections`+`voice_phone_numbers`). Pula sozinho (exit 0) se `SUPABASE_DB_URL` não
  estiver setado.
- **Consequência documentada da decisão de `tsx`**: este processo não pode ser empacotado como
  container standalone leve como o worker Telnyx — precisa do checkout completo do repo +
  `node_modules` da raiz + `tsx`. Não há `Dockerfile` pra isto.

### Commits de docs (`c67b7210`, `41e86ae8`, `e18bd140`, `9a5dc136`, `10b7a0e8`)
Sincronizaram `docs/current-state-voice-core.md`, `docs/handoffs/HANDOFF-voice-core.md` e
`docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` a cada fatia, mais uma
passada final de consistência (contagem desatualizada, arquivo faltando na lista de "arquivos
críticos", diagrama de arquitetura incompleto).

---

## Env vars que `main.mjs` espera (todas obrigatórias, exceto `PORT`)

```
ARI_BASE_URL             ex: http://127.0.0.1:8088
ARI_USERNAME
ARI_PASSWORD
ARI_APP_NAME             nome do app Stasis registrado no dialplan do Asterisk
SIP_OUTBOUND_CONTEXT     contexto do dialplan pra originate outbound
VOICE_CONTROL_PLANE_URL  URL base do CRM
INTERNAL_SECRET          mesmo secret compartilhado do worker Telnyx
SUPABASE_DB_URL          acesso Postgres (ver caveat de "no database credentials" acima)
PORT                     porta do /healthz, default 8090
```

## Como rodar o gate completo

```bash
export SUPABASE_DB_URL="postgresql://..."   # opcional — sem isso, main.smoke.mjs pula sozinho
bash scripts/verify-voice-core.sh
```

As 8 fatias passaram nos checkpoints anteriores. No último snapshot, a suíte Voice passou com
43 ficheiros/199 testes; o gate completo não fechou porque `pnpm typecheck` esgotou o heap do
runner. Não chamar o gate de verde sem uma nova execução completa.

## O que está **verificado** vs. o que **não está**

Tudo acima é `IMPLEMENTED` + `VERIFIED PROVIDER-FREE` (a fatia 8 também `VERIFIED` contra
Postgres real). A bridge foi ligada parcialmente a Asterisk real na VPS e o worker respondeu
`/healthz`, mas **não é `VERIFIED LIVE`**: não houve chamada telefónica completa com áudio de IA.

## O que fica pendente pro Codex (ordem de prioridade)

1. **Concluir o teste contra Asterisk real.** A bridge já foi ligada parcialmente na VPS. Falta
   registrar uma extensão/softphone ou conexão SIP/BYOC real, manter `SIP_CONNECTION_ID` no
   dialplan e concluir inbound/outbound com trace completo.

2. **Melhorias de robustez, não bloqueantes:**
   - Alerta/observabilidade se o listener ficar reconectando repetidamente contra um endpoint
     morto (hoje só loga, sem alarme).
   - Descoberta de um Asterisk alternativo — hoje a reconexão automática só tenta de novo contra
     o mesmo `ARI_BASE_URL` configurado na criação.

3. **Ligar o caminho de áudio real:** Asterisk/RTP → Pipecat → faster-whisper → Agent OS →
   Piper/Kokoro → Asterisk. Os adapters existem; os processos live/media bridge ainda precisam
   ser executados num host adequado. OpenVoice, catálogo, preview e consentimento continuam
   pendentes.

4. **Rodar o gate completo** num runner com heap suficiente, depois testar transferência,
   reinício, perda de conexão, latência e custo.

## Invariantes de segurança — NÃO QUEBRAR

Herdadas do `HANDOFF-voice-core.md` seção 4, todas continuam valendo pro código novo:

- Nunca confiar em `organization_id` vindo de cliente/worker — resolver sempre por join no banco.
- Resolver organização pela conexão SIP verificada antes de qualquer outra coisa (nunca lookup
  global de telefone entre tenants).
- Não reabrir chamada terminal por evento atrasado; não trocar `provider_call_id` já estabelecido
  (ambos já garantidos pela mesma query SQL usada nos dois caminhos, Telnyx e SIP).
- Não promover Product Agents de `shadow` "pra fazer funcionar".
- **Não mergear pra `main` sem autorização explícita do dono do repo.**

## Branches

Nesta sessão, **só `implementacao-tokens-voice-core` foi alterada** (13 commits, todos já
enviados pro GitHub). `main` não foi tocada.

Separadamente, também investiguei (sem alterar) uma auditoria de branches órfãs do repositório —
5 branches já mergeadas (`docs/complete-doc-sync`, `docs/dead-cache-doc-refs`,
`fix/inbox-item-severity-vocab`, `fix/squad-e2e-handoff-continuity`, `sync/upstream-cherrypicks`)
que o dono do repo aprovou apagar, mas a sessão Claude não conseguiu (bloqueio de política de
rede do proxy, não de permissão de conta) — segue pendente de o dono apagar manualmente pelo
GitHub. Não relacionado ao Voice Core.
