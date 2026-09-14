# Auditoria de entradas de providers — V1

Data: 2026-09-12  
Escopo: leitura do checkout no worker `claude@192.168.1.78`, usando `~/.ssh/lumenva_worker`.  
Worker/repositório: `/home/claude/src/Lumenva`  
Ref observada: branch `main`, `HEAD=22e87a6feb632be3600f32301708bbacf756c07b`, worktree limpo e alinhado a `origin/main`.

Não foram executados build, testes, Docker, chamadas de provider ou qualquer efeito externo. A classificação “teste provider-free” abaixo é por inspeção estática da suíte; não é um resultado de execução.

## Resumo

| Provider | Entradas de código encontradas | Provider-free/mock encontrado | Credencial real/configuração | Veredito |
|---|---|---|---|---|
| Stripe | Nenhuma integração Stripe, nenhum import/dependência ou teste específico encontrado | Não aplicável | Não há `STRIPE_*` no `.env.example`; não há integração a validar | `NOT_PROVEN` / ausência de implementação |
| WAHA | `apps/crm/lib/waha/client.ts`, `send.ts`, `media-send.ts`, `apps/crm/lib/channels/adapters/waha.ts`, engines, rotas de onboarding/sessões e webhooks | Sim. `apps/crm/tests/unit/channel-adapter-waha.test.ts` intercepta `fetch`, cobre `isConfigured=false`, NOOP sem rede e envio; `apps/crm/lib/waha/webhook-auth.test.ts`, `media-waha-source.test.ts`, `waha-media-send.test.ts`, ingest/webhook tests | O cliente exige `WAHA_API_BASE_URL` + `WAHA_API_KEY`; `getWahaClient()` retorna `null` sem ambos ou com placeholder (`client.ts:218-222`). O `.env.example` deixa chave/webhook/base pública vazios. Não foi encontrada `.env.local` no checkout auditado | Mock/provider-free: `PASS (inspeção)`; credencial real: `NOT_PROVEN` |
| Resend | `apps/crm/lib/email/resend.ts`; callsites em convites, onboarding, LGPD e cron | Há teste provider-free do relay HTTP: `apps/crm/app/api/internal/notifications/email/route.test.ts` mocka Resend-indiretamente (`sendMessageHandler`, Supabase, env) e cobre `EMAIL_RELAY_DRY_RUN`; não há teste dedicado de `sendEmail()`/SDK Resend | `sendEmail()` cria `new Resend(key)` apenas quando `RESEND_API_KEY` existe e tem pelo menos 10 caracteres (`resend.ts:27-34`); sem chave retorna `not_configured` e não envia (`:41-57`). `RESEND_API_KEY` não aparece no `apps/crm/.env.example` consultado. Nenhuma `.env.local` foi encontrada | Mock/provider-free: `PARTIAL`; credencial real: `NOT_PROVEN` |
| Supabase | Clientes browser/server/admin em `apps/crm/lib/supabase/{browser,server,admin}.ts`, usados extensivamente por actions/routes/workers; Postgres direto em scripts | Sim, em grande escala: testes mockam `@/lib/supabase/server` e/ou `@/lib/supabase/admin`; exemplos `signInWithPassword.test.ts`, `route.test.ts` de notifications, `channel-sessions/[id]/route.test.ts`, suites invariants/unit. `cookie-secure.test.ts` mocka env. Estes são contratos unitários, não prova de banco/RLS real | `lib/env.ts:41-44` marca `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` obrigatórias sempre; `admin.ts:24-38` usa service role (bypassa RLS), `server.ts:14-41` usa SSR/anon. `SUPABASE_DB_URL` é exigida para caminhos de Postgres direto. Sem `.env.local` no checkout auditado, valores reais não foram confirmados | Mock/provider-free: `PASS (inspeção)`; credencial/banco/RLS real: `NOT_PROVEN` |

## Detalhes por provider

### Stripe

Busca estática case-insensitive no código executável, dependências `package.json`, templates de ambiente e nomes de testes não encontrou `stripe`, `Stripe`, `STRIPE_SECRET_KEY` ou `STRIPE_WEBHOOK_SECRET` com integração correspondente. Portanto não há ponto de entrada Stripe implementado neste SHA. Isso não prova que não exista configuração fora do repositório nem que cobrança esteja coberta.

### WAHA

O ponto de rede canônico é `WahaClient`, que faz `fetch` para `/api/sessions`, `/start`, `/stop`, `/logout`, `/api/sendText`/mídia e exige `X-Api-Key`. `getWahaClient()` falha fechado para ambiente ausente/placeholder. As rotas de sessão, QR, onboarding, webhooks e o adapter de canal encaminham para essa fronteira.

Evidência provider-free: `channel-adapter-waha.test.ts` usa `vi.stubGlobal('fetch', ...)` e `vi.stubEnv(...)`; cobre ausência de configuração sem chamada de rede e respostas simuladas. Há cobertura adicional de autenticação HMAC, ingestão, mídia, IDs e engine. Nenhuma dessas provas chama WAHA real.

Dependência real: `WAHA_API_BASE_URL`, `WAHA_API_KEY`, `WAHA_WEBHOOK_BASE_URL` são variáveis obrigatórias em produção (`lib/env.ts:77-84`); o audit não leu nem expôs valores secretos. Não foi feita probe de rede.

### Resend

`sendEmail()` é a única fronteira SDK identificada (`import { Resend } from "resend"`). O comportamento sem chave é explícito e seguro: `not_configured`; em desenvolvimento registra apenas payload parcial para diagnóstico. Os callsites podem tratar isso como falha ou degradação.

O teste de notifications cobre relay em dry-run e mocks de dependências, mas não substitui um teste unitário direto do wrapper Resend (construção do cliente, `emails.send`, rate limit e exceção). Assim a cobertura é `PARTIAL`, não `PASS` completo.

Não há prova de `RESEND_API_KEY`, domínio remetente verificado ou entrega real. A E2E `vps-fresh-onboarding.spec.ts` documenta o cenário sem Resend, mas não foi executada nesta auditoria.

### Supabase

Há três entradas principais: browser (`createBrowserClient`), server (`createServerClient` com cookies) e admin (`createSupabaseClient` com service role). A superfície de aplicação é extensa; a lista de arquivos é deliberadamente agregada, pois as rotas/actions importam esses clientes repetidamente.

Evidência provider-free: numerosos testes usam `vi.mock("@/lib/supabase/server", ...)` e/ou `vi.mock("@/lib/supabase/admin", ...)` com chains fake (`from`, `select`, `insert`, etc.). Isso prova isolamento de handlers e contratos, não conectividade, schema, RLS ou Auth reais. Testes de RLS/E2E que exigiriam banco real permanecem fora de execução nesta tarefa.

## Gaps que permanecem abertos

- **ACHADO CRÍTICO CONFIRMADO (2026-09-12):** a `main` em `a84052ca57f99e906f8a7cda4efd2c8a5defc31d` não contém os testes/implementação Stripe esperados; a execução dos caminhos `tests/api/stripe-webhook-route.test.ts` e `tests/api/stripe-checkout-route.test.ts` terminou com `No test files found`, exit `1`, e contagem `0` testes executados.
- `NOT_PROVEN`: qualquer credencial real Stripe, WAHA, Resend ou Supabase; não foram lidos secrets nem feitas probes.
- `NOT_PROVEN`: entrega Resend, sessão/QR/envio WAHA real, Supabase Auth/PostgREST/Storage/Realtime, RLS efetivo e replay de migrations.
- `PARTIAL`: falta teste unitário dedicado do wrapper `lib/email/resend.ts` com SDK mockado.
- `NOT_PROVEN`: Stripe — não há implementação/ponto de entrada neste SHA; se cobrança for requisito, precisa definição e implementação separadas.

## Self-check

PASS — somente leitura; SSH pelo worker solicitado; sem build/teste pesado; sem download; sem impressão/cópia de secrets; relatório vinculado ao SHA observado.
