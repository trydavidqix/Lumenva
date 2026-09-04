# Architecture — Lumenva

> Visão de 1 página. Profundidade vive em `docs/specs/` e `docs/stories/epics/MASTER.md`.
> Mapa de toda a documentação: [`docs/index.md`](docs/index.md).
> Estado real de implementação (o que está pronto vs. incompleto): [`docs/current-state.md`](docs/current-state.md).

## Camadas

- **App (Next.js 16 App Router)**: UI + Route Handlers no mesmo repo. Server Components por default, Client onde precisa de estado. Middleware de borda em `proxy.ts` (Next 16 renomeou `middleware.ts` → `proxy.ts`).
- **DB (Supabase Postgres)**: RLS em toda tabela tenant-aware via `fn_user_org_ids()`. Migrations versionadas em `supabase/migrations/`.
- **Auth (Supabase Auth + `@supabase/ssr`)**: cookie SameSite=Strict, MFA TOTP forçado pra admin/super-admin. Sempre `getUser()` no server.
- **Realtime (Supabase Realtime)**: `postgres_changes` para inbox/kanban; `broadcast` para sinais leves.
- **Storage (Supabase Storage)**: bucket `whatsapp-media` privado, URLs assinadas.
- **WhatsApp (WAHA Plus / engine NOWEB)**: HMAC-SHA512 webhooks; throttle anti-banimento; STOP detection.
- **Filas (event sourcing leve)**: `event_log` table + workers via cron. Trigger Postgres NUNCA faz HTTP.
- **Rate limit (Upstash Redis)**: contador de **janela fixa** (`INCR` + `EXPIRE`) com fallback
  in-memory quando Redis falta. Está aplicado no dispatcher de IA, auth/API sensíveis e nos
  webhooks públicos Meta, WAHA e Nuvemshop; o fallback continua por processo e não substitui
  Redis distribuído. Ver [`docs/current-state.md`](docs/current-state.md) §4.3 e
  [`docs/threat-model.md`](docs/threat-model.md) §T1.
- **AI (Vercel AI Gateway + providers diretos)**: Anthropic/OpenAI/Google para geração e
  embeddings configuráveis, com override de embeddings compatível com NVIDIA Build.
- **Observability (Sentry)**: `beforeSend` scrubs PII (CPF/email/phone) e headers sensíveis.

## Voz por SIP/BYOC

O cliente mantém o próprio número. A camada de voz entra entre a operadora SIP/BYOC e o CRM:
Asterisk/ARI recebe a chamada, o worker SIP normaliza eventos e Pipecat conduz o áudio;
faster-whisper faz STT e Piper ou Kokoro faz TTS. OpenVoice é apenas uma opção de clonagem autorizada.

O CRM continua sendo a autoridade para organização, contacto, memória, Agent OS, tokens,
políticas, tools, handoff e auditoria. O runtime de voz não cria um segundo agente, não acessa
tools comerciais diretamente e não pode trocar tenant ou idioma silenciosamente.

A camada de sinalização (controle da chamada: ARI, tenant, listener, forwarder pro CRM) está
implementada e testada de ponta a ponta em `origin/implementacao-tokens-voice-core` (`d3c97cbd`),
mas não está integrada nesta branch. O caminho de áudio real (Pipecat/faster-whisper/Piper/Kokoro)
está bloqueado por infraestrutura — precisa de host com mais recursos que a VPS atual, decisão de
custo pendente do dono — e o deploy do Asterisk ainda não está versionado no Git. Detalhes e
estado real: [`docs/voice/open-source-europe.md`](docs/voice/open-source-europe.md) e
[`docs/handoffs/HANDOFF-voice-vps-config-2026-08-28.md`](docs/handoffs/HANDOFF-voice-vps-config-2026-08-28.md).

## Multi-tenancy

`organization_id uuid not null` em toda tabela tenant-aware. RLS via helper. Service role bypassa RLS — handlers admin **DEVEM** filtrar `organization_id` manualmente, resolvido de fonte confiável (cookie/JWT/webhook secret/path token), nunca do body.

Detalhes: [`docs/specs/01-spec-platform-base.md`](docs/specs/01-spec-platform-base.md).

## API REST `/api/v1/`

- JSON snake_case. UUID v4. ISO-8601 UTC. Dinheiro `_cents` + `currency`.
- Wrappers `ok()` / `fail()` em `lib/api/wrappers.ts`.
- Auth dual: cookie session (frontend) ou `Authorization: Bearer tok_...` (server-to-server).
- `X-Request-Id` em toda response, injetado em `proxy.ts` e correlacionado com o audit log.
- `Idempotency-Key` existe em mutações selecionadas (incluindo aprovação de pedido de privacy);
  não é uma garantia transversal para todos os POSTs. Ver [`docs/current-state.md`](docs/current-state.md).
- Detalhes: [`docs/specs/01-spec-platform-base.md`](docs/specs/01-spec-platform-base.md) §API.

## Fluxo de uma requisição

**Rota autenticada de tenant** (`/api/v1/*`, 166 handlers):

```
request → proxy.ts (X-Request-Id, x-pathname; isPublicPath? → bypass;
                    senão valida sessão Supabase via cookie sb-deskcomm-auth)
        → route handler:
             1. Zod valida o input externo
             2. guard: requireRole() | requirePlatformAdmin() | secret/HMAC
             3. resolveActiveOrg() → organization_id de fonte confiável (nunca do body)
             4. query (RLS pelo client de sessão, ou filtro manual de org com service role)
             5. audit() fire-and-forget se houve mutação
             6. ok(data, meta) | fail(code, message, status)
```

**Superfícies não-cookie:** `/api/v1/cron/*` (Bearer `INTERNAL_CRON_SECRET`, fail-closed),
`/api/internal/*` (`x-internal-secret`), `/api/mcp` (Bearer `tok_...` contra `api_tokens`),
`/api/v1/webhooks/*` (HMAC + path token). Inventário completo em
[`docs/threat-model.md`](docs/threat-model.md) §1.

**Turno do agente de IA:** inbound WhatsApp → HMAC + idempotência → `event_log` →
worker → `runAgentTurn` (RAG + tools MCP) → guardrails before-send → adapter WAHA →
handoff humano se gatilho. Diagrama: [`docs/architecture/agent-turn.html`](docs/architecture/agent-turn.html).

## Event log + workers

Triggers Postgres emitem linhas em `event_log`. Workers (cron / Realtime listener) consomem e disparam side effects. Idempotência via `unique (organization_id, external_id)` + captura `code === '23505'`.

Workers vivem em `workers/` (`ai-response`, `ai-sentiment`, `rag-indexer`, `media-persist`,
`media-derive`, `lgpd-export`, `lgpd-redact`, `storage-cleanup`, `agent-worker`), drenados
pelos 10 endpoints em `app/api/v1/cron/`. Contrato: [`docs/specs/07-spec-events-workers.md`](docs/specs/07-spec-events-workers.md).

## Integrações externas

| Serviço | Uso | Onde | Falta ⇒ |
|---|---|---|---|
| **Supabase** | Postgres + Auth + Realtime + Storage | `lib/supabase/{browser,server,admin}.ts` | app não sobe (obrigatório sempre) |
| **WAHA Plus** (NOWEB) | WhatsApp: envio, recebimento, sessões multi-número | `lib/waha/` | canal indisponível; obrigatório em produção |
| **Upstash Redis** | rate limit + debounce de RAG | `lib/ai/dispatcher/rate-limit.ts`, `lib/ai/rag/debounce.ts` | degrada para memória com `warn` |
| **Vercel AI Gateway** | LLM + embeddings (`@ai-sdk/anthropic\|openai\|google`) | `lib/ai/` | agente não responde |
| **Nuvemshop** | e-commerce: pedidos, produtos, webhooks LGPD | `lib/nuvemshop/` | opcional (`NUVEMSHOP_ENABLED`) |
| **Sentry** | erros + performance, `beforeSend` higieniza PII | `sentry.*.config.ts`, `instrumentation*.ts` | opcional |
| **Resend** | e-mail transacional (convite de time) | `lib/email/` | opcional — o convite cai em copy-to-clipboard |
| **MCP** | CRM exposto como tools para agentes | `app/api/mcp/`, `lib/mcp/` | — |
| **Asterisk/ARI + Pipecat** | Voz SIP/BYOC e runtime provider-neutral | `docs/voice/` e branch Voice Core | bridge parcial; áudio live ainda pendente |

## Hardening

- Error boundaries em `app/error.tsx`, `app/app/error.tsx`, `app/(public)/error.tsx`, `app/global-error.tsx` (Sentry capture + eventId visível).
- Páginas customizadas 404/403/500/503 com copy PT-BR canônica.
- Loading skeletons em rotas P0.
- E2E Playwright + axe-core.
- Detalhes: [`docs/stories/epics/EPIC-12-hardening.md`](docs/stories/epics/EPIC-12-hardening.md).

## Onde olhar a fundo

- [`docs/prd/`](docs/prd/) — PRDs (visão, escopo MVP, KPIs, plataforma base, customer 360, WhatsApp, pipeline, IA-RAG, Nuvemshop).
- [`docs/specs/`](docs/specs/) — specs técnicas com schema SQL e payloads.
- [`docs/business-rules/`](docs/business-rules/) — regras de negócio fora do código.
- [`docs/stories/epics/MASTER.md`](docs/stories/epics/MASTER.md) — plano de execução por epic/wave.
- [`CLAUDE.md`](CLAUDE.md) — convenções não-negociáveis (multi-tenancy, idempotência, RBAC, LGPD, WAHA, anti-patterns).
- [`AGENTS.md`](AGENTS.md) — contrato portável para agentes de código (qualquer ferramenta).
- [`docs/index.md`](docs/index.md) — índice de toda a documentação.
- [`docs/harness-audit.md`](docs/harness-audit.md) — maturidade do harness e lacunas de verificação.
- [`docs/threat-model.md`](docs/threat-model.md) — superfície de ataque do self-host.
