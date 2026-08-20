---
type: current-state
project: DeskcommCRM
status: draft
last_updated: 2026-07-29
generated_by: auditoria documental (Claude Code) — leitura de código, HANDOFFs, plan/, loop/, CI
confidence: média-alta (métricas de código são CONFIRMADO; estado de épico vem dos HANDOFFs, que são auto-relatados)
audited_against: origin/main @ 789dfa6 (v1.0.0, 2026-07-27)
---

# Estado atual — DeskcommCRM

Este documento existe porque "o que está pronto" estava espalhado em 5 `HANDOFF-*.md`
na raiz, `plan/progress.md`, `loop/checkpoints/`, `tasks/todo.md` e o roadmap do README —
sem lugar único. Um agente novo (ou o dono, depois de uma semana) não conseguia responder
"posso subir isso?" sem ler ~1500 linhas.

**Aviso de método:** o estado de épico abaixo vem dos HANDOFFs, que são *auto-relatados
pelas sessões que fizeram o trabalho*. Estão densos em evidência (outputs de teste,
screenshots), o que é bom sinal, mas nada aqui foi re-verificado por execução nesta
auditoria — a auditoria é read-only por instrução. Métricas de código, contagem de
arquivos, conteúdo de CI e cobertura de padrão **foram** verificados diretamente.

**Revisão de manutenção (2026-07-30, `origin/main` @ `b190bbf`):** as contagens da §1 e as
versões de biblioteca do `AGENTS.md` foram remedidas por um mantenedor na revisão do PR #60.
Onde a régua divergiu, ela passou a ser declarada junto do número. O estado de épico (§2–§3)
**não** foi re-verificado nesta revisão — segue valendo o aviso acima.

**Revisão de manutenção (2026-08-19, `main` local @ `5eb118ef`, 3 commits à frente de
`origin/main`):** sessão operacional, não reauditoria — não recontou §1–§3. Cobre só o que foi
de fato executado/verificado nesta sessão, registrado em detalhe no §4.10:

- `test:db`/`test:invariants` deixou de exigir Docker — engine nativo (Homebrew `postgresql@17`
  + `pgvector`) com fallback automático, commit `7fe2929c`. Isto fecha, parcialmente, a
  "armadilha de conhecimento tácito" que o `harness-audit.md` já registrava no item 20.
- 3 bugs reais corrigidos e commitados em `main`: colisão de `NNNN` em migrations (`867d0203`),
  sintaxe inválida de `COMMENT ON ... || ...` que quebrava instalação fresh (`5eb118ef`),
  e uma race TOCTOU entre projeção de memória e anonimização LGPD (`cd2b7249` — **fica na
  branch `ai-platform-gate`, não em `main`**; não confundir com os dois primeiros).
- O projeto Supabase rotulado PRODUCTION (`idqlutosaqqqqxetepen`) nunca tinha recebido o
  schema — 3 tabelas existiam, `baseline.sql` nunca tinha sido aplicado de verdade lá. Aplicado
  agora (100 tabelas) e o histórico de migrations reconciliado (`supabase migration repair`,
  103 versões). Isto era um bloqueio de lançamento não documentado em lugar nenhum.
- **Achado novo, sem cobertura prévia em nenhum doc:** os templates de e-mail do Supabase Auth
  (`confirm-sign-up`, `reset-password`) e o SMTP customizado são configuração do **Dashboard do
  projeto hospedado**, não de `supabase/config.toml` — `config.toml` só se aplica a
  `supabase start` local ou via `supabase config push` (que também sobrescreveria `site_url`
  para `localhost`, então **não** é o comando certo para sincronizar produção). O projeto de
  produção estava usando os templates default do Supabase (`{{ .ConfirmationURL }}`, formato
  PKCE `?code=`), incompatíveis com a rota `app/auth/confirm/route.ts` (espera
  `?token_hash=&type=`) — cadastros confirmavam o e-mail mas nunca provisionavam a organização
  do tenant, silenciosamente. Corrigido colando manualmente o conteúdo de
  `supabase/templates/confirmation.html` e `recovery.html` no Dashboard. Sem gate automatizado
  contra essa deriva — ver §4.10.

---

## 1. Números do repositório — CONFIRMADO

**Versão:** `1.0.0`, marcada em 2026-07-27 (`CHANGELOG.md`). Primeira release versionada;
o projeto vinha sendo desenvolvido publicamente desde abril de 2026 sem tags.

| Métrica | Valor |
|---|---|
| Arquivos TS/TSX em `app`+`lib`+`components`+`workers` | 987 |
| Route handlers (`app/api/**/route.ts`) | 169 |
| Migrations em `supabase/migrations/` | 81 arquivos, até `0092_stage_names_acentos` |
| Testes unitários (`*.test.ts(x)`) | 221 arquivos |
| Invariantes de banco (`tests/invariants/`) | 56 arquivos |
| Specs E2E (`tests/e2e/`) | 19 |
| Documentos `.md` em `docs/` | 119 (em 23 subpastas) |
| Import cycles | **0** (graphify, medido em árvore anterior) |
| `console.log` fora de `lib/logger.ts` | **0** |
| `: any` / `as any` | 7 |

**Higiene de código é boa.** Zero ciclos de import, logger centralizado respeitado,
quase nenhum `any`. Os god nodes do grafo (`fail` 325 arestas, `createAdminClient` 323,
`ok` 305, `audit` 290, `requireRole` 230) são *helpers canônicos* — indicam convenção
sendo aplicada, não acoplamento acidental.

**Doutrina de migrations está sendo cumprida** — CONFIRMADO: o apêndice idempotente de
`baseline.sql` cobre até `migration 0092`, que é a última em `supabase/migrations/`. Os
artefatos de schema andam juntos como a doutrina exige — o kit self-host recebe as
mudanças. Esse é o invariante mais fácil de quebrar num projeto open-source e ele está de pé.

---

## 2. O que está entregue

Conforme o roadmap do README (INFERIDO como fiel — cada item tem código e testes
correspondentes localizados no repo):

- **Fundação & plataforma** — auth com MFA para admin, multi-tenancy com RLS + teste de
  isolamento, RBAC de 4 papéis, audit log append-only, onboarding de tenant.
- **Atendimento WhatsApp** — inbox de 3 painéis em tempo real, conexões WAHA multi-número,
  mídia via Storage, anti-banimento (throttle + jitter + janela de horário), STOP detection.
- **CRM & pedidos** — kanban com vocabulário configurável por nicho (fractional indexing),
  customer 360, contatos, tags, Nuvemshop.
- **IA nativa** — agentes com RAG por tenant (pgvector), sentiment, handoff IA→humano,
  budget por org, MCP server interno.
- **LGPD** — export e redact via workers, anonimização em cascata, consentimento auditado.
- **Self-host** — `hostgator-setup-kit`, `baseline.sql` auto-curativo, runbook de produção.
- **Webhooks & automação** — captação + regras QUANDO/SE/ENTÃO + gatilhos externos.
- **Operação visível** — transparência do motivo de retenção anti-ban, central de avisos,
  knobs de proteção de envio, propostas do flywheel com gate humano.

### Épico de Governança de Atendimento (G1–G6) — COMPLETO

CONFIRMADO em `plan/features.json` (31/31 features com `passes: true`) e
`loop/checkpoints/` (relatórios G1–G6 + os 6 arquivos `.approved`).
Guiado por 100+ invariantes de banco. Fechou em 2026-07-18.

Entregou: RBAC server-side em toda a API, atribuição e transferência auditadas
(IA como assignee de primeira classe), visibilidade por papel via RLS, métricas por
atendente, roteamento automático com fila e painel de gestão, e `docs/specs/14` —
o contrato de governança para agentes de IA externos.

---

## 3. O que está incompleto — por épico

| Épico | Estado relatado | O que falta |
|---|---|---|
| **Follow-up inteligente** (`HANDOFF.md`) | Ondas 1–7 ✅; Onda 8 **em andamento** (8.1 gatilho de silêncio ✅, 8.3 jornada E2E ✅) | gatilho `stage_change`, flywheel, e o fechamento do checklist DoD/PRD da 8.3 |
| **Evolução do harness** (`HANDOFF-harness-evolution.md`) | **ÉPICO COMPLETO** — Fases 0–4 fecharam, a última (Painel de Evolução) em 2026-07-27. Mais duas continuações entregues: mapeamento de funil do agente (27/jul) e gerenciar etapas do funil (28/jul) | **uma prova em aberto, e é do dono:** ninguém mandou uma mensagem real de WhatsApp fechando o ciclo completo. Receita de 1 min no fim do HANDOFF |
| **Operação visível** (`HANDOFF-operacao-visivel.md`) | F1, F2(i), F2(ii), F3 ✅ localhost com evidência Playwright | prova na VPS após publicar (cada feature exige prova dupla: localhost **e** VPS) |
| **Casos humanos** (`docs/handoffs/HANDOFF-casos-humanos.md`) | Waves 1–6 ✅ e revisadas; Wave 7 (prova E2E) relatada PARCIAL — interrompida por limite de API, não por bug | **A CONFIRMAR** se fechou: o HANDOFF saiu da raiz para `docs/handoffs/`, o que normalmente sinaliza épico encerrado |
| **Inbox multimodal** (`docs/handoffs/HANDOFF-inbox-multimodal.md`) | Ondas 0–3.1 ✅ com prova real (WhatsApp real, mídia real) | **A CONFIRMAR** o estado das ondas 4–6. **Bloqueios externos que valem revalidar:** chave Google era de gateway (gemini real inacessível) e credencial Anthropic era placeholder (`last4 1234`) — o agente multimodal foi provado só em OpenAI/gpt-4o |
| **Fase FG / Vendaval** | Não iniciada | O gatilho era a aprovação de G6, que existe (`G6.approved`). O README **não lista mais** a Fase FG em "Próximo" — **A CONFIRMAR** se saiu de escopo ou foi absorvida |

### Próximo no roadmap (não iniciado — CONFIRMADO no README)

MCP público · flywheel de auto-aprimoramento · templates por nicho (clínica,
imobiliária, infoproduto, serviços) · VTEX e Shopify via adapter · identity probabilística.

### Dois achados de produto registrados e não endereçados

Vêm do `HANDOFF-harness-evolution.md`, anotados como "não são desta feature":
**transbordo de layout a 390px em qualquer tela** e **não existe caminho de criação de
funil** (só de etapas). O primeiro é bug de primeira impressão em mobile.

---

## 4. O que está quebrado ou frágil — CONFIRMADO

Estes são achados de código/config verificados nesta auditoria, não relatos.

### 4.1 Os E2E quase não rodam no CI 🟠 — parcialmente resolvido em 2026-07-30

> **Atualização (2026-08-05, issue #63):** `e2e.yml` roda **28 das 32 specs** contra Supabase
> local com o `baseline.sql` aplicado. Não-obrigatório ainda. A primeira execução real já
> pagou o job: achou a página `/500`, que `public-paths.ts` declarava pública e **nunca havia
> sido criada**. A rodada de 2026-08-05 pagou de novo: as 12 specs do épico IA 360 nunca
> tinham entrado no gate, e ao rodá-las apareceu um defeito de produto real
> (`capacidades-do-agente` — o teto de 20 capacidades desabilita a crítica que o desenho manda
> marcar à mão). As 4 restantes seguem sem gate — o texto abaixo continua valendo para elas.

O gate de isolamento RLS **roda** — `ci.yml` tem o job `invariants` chamando `pnpm test:db`,
que sobe `pgvector/pgvector:pg17`, aplica `baseline.sql` em modo install e update, e roda os
56 arquivos de `tests/invariants/`. Esse buraco está fechado.

O que continua fora: **4 das 32 specs Playwright**. A `vps-webhook-outbound-ssrf.spec.ts`,
única prova automatizada do guard de SSRF, **passou a rodar** no `e2e.yml`. Mas a
`vps-fresh-onboarding.spec.ts` — a jornada que a doutrina de QA Visual classifica como o
caminho mais crítico do produto — continua fora, porque exige WAHA + Redis + Resend +
Nuvemshop no runner. Regressão nela passa sem detecção (issue #63).

O `e2e` também **ainda não é check obrigatório** na branch protection, que exige apenas
`verify`, `build-and-size` e `invariants`. Enquanto for opcional, um PR que quebre o e2e
entra na `main` assim mesmo. **Ponto morto adicional (2026-08-20): GitHub Actions está
desabilitado permanentemente (§10)** — `e2e.yml` não dispara mais de forma nenhuma, então
"não obrigatório" já nem é a questão certa; hoje esta spec só roda se alguém a disparar
manualmente com Docker de pé (Supabase local + WAHA + Redis).

**Tentativa de rodar nesta sessão (2026-08-20):** bloqueada de saída — Docker indisponível
nesta estação (decisão do usuário de não rodar Docker no Mac), e a spec exige Supabase local
via `supabase start` + WAHA + Redis, todos Docker. Sem isso, fiz revisão estática em vez de
execução: li o spec inteiro (13 casos, J1.1–J1.13) contra o código real de cada tela —
`app/onboarding/layout.tsx` (gate onboarded_at → redirect), `app/onboarding/page.tsx` (router
de step), `welcome/_form.tsx` + `acceptWelcome.ts`, `connect-whatsapp/_client.tsx` +
`skipWhatsapp.ts`, `setup-ai/_form.tsx` + `createDefaultAgent.ts`, `invite-team/_form.tsx` +
`sendOnboardingInvites.ts`, `finishOnboarding.ts`, `MfaEnrollGate.tsx`, e o `_shared.ts` comum
a todas as actions. **Nenhum defeito encontrado** — inclusive as duas regressões que o spec
documenta terem sido corrigidas (redirect hardcoded pro Nuvemshop em vez de deixar o router
decidir; gate MFA desmontando via revalidação do Server Action e perdendo os códigos de
recuperação) batem com o código atual (`useState(!enrolled)` latching em
`MfaEnrollGate.tsx:26`, `redirect("/onboarding")` em vez de rota fixa em `skipWhatsapp.ts:19`).

**O que isso NÃO prova**, e por que continua sendo um gap real: leitura estática não exercita
render de imagem (o QR code realmente carrega bytes válidos?), não prova timing real de TOTP
contra o banco, não prova RLS sob concorrência, não prova o handshake HMAC do WAHA de verdade.
Fica aberto até alguém rodar com Docker disponível (VPS de teste, ou Docker Desktop
temporariamente nesta estação).

`vitest.config.ts:12` exclui `tests/invariants/**` e `tests/e2e/**` do `test:unit`. Para os
invariantes isso é deliberado e correto (o job de CI os pega). Para os E2E, o `e2e.yml` pega
metade.

### 4.2 `pnpm gov:verify` não é o comando único que aparenta ser 🟠

`gov:verify` = `typecheck && lint && test:unit`. Omite `test:db` e `test:e2e`. Um agente
que trate `gov:verify` verde como "pronto" vai declarar concluída uma mudança de schema
sem nunca ter testado RLS. O CI pega o `test:db` depois do push, mas o loop local mente —
e o nome do script sugere cobertura total que o conteúdo não entrega.

### 4.3 Rate limit HTTP — ✅ fechado em 2026-08-20 (era 🔴 desde a auditoria de julho)

**Achado desta auditoria (julho/2026), já obsoleto no código:** afirmava que `checkRateLimit`
só era chamado em 2 lugares (webhook de captação + dispatcher de IA), com `/login`, `/signup`,
`/team/accept-invite/:token`, crons, `/api/internal/*` e `/api/mcp` desprotegidos. Isso não
reflete mais o repo — a issue #64 (antes desta sessão) já tinha coberto login/signup/reset/MFA/
convite via `lib/auth/rate-limit.ts`, e `/api/mcp` + `/api/internal/agents/run` já tinham
`checkRateLimit` próprio. Os crons são protegidos por secret fail-closed (`INTERNAL_CRON_SECRET`),
não por rate limit — controle correto para superfície não pública.

**Gap real, confirmado e fechado nesta sessão:** os 7 webhooks públicos de canal/integração
não tinham nenhum rate limit — HMAC valida a assinatura, mas só depois de já ter recebido e
processado o corpo, então um flood de POSTs (mal-formados ou não) consumia I/O/CPU antes de
qualquer rejeição. Adicionado `checkRateLimit` (mesmo padrão já usado no webhook de captação),
o mais cedo possível após resolver o identificador de tenant, antes de qualquer lookup no banco:

- `webhooks/waha/[token]` e `webhooks/waha` (global) — 120/min por sessão;
- `webhooks/meta/[token]` (POST) — 120/min por sessão;
- `webhooks/nuvemshop/[event]` — 60/min por loja;
- `webhooks/nuvemshop/store-redact`, `customer-data-request`, `customer-redact` (LGPD) —
  30/min por loja (evento raro/crítico; teto baixo ainda permite retentativa legítima).

Sem teste de rota dedicado (nenhum dos 7 handlers tinha harness de teste antes desta mudança —
exigiria mockar Supabase admin client + HMAC por webhook; fora do escopo desta correção). Prova:
`pnpm typecheck` e `pnpm lint` limpos, diff mínimo (80 linhas, 7 arquivos, mesmo padrão de 4
linhas repetido, já em produção em 3 rotas — `webhooks/in/[token]`, `/api/mcp`,
`/api/internal/agents/run`). Detalhe/impacto original em [`threat-model.md`](threat-model.md).

### 4.4 `node_modules` deste checkout está incompleto 🟠

70 pacotes, sem `typescript` — `pnpm typecheck` falha com `MODULE_NOT_FOUND`. Resolve-se com
`pnpm install` (não executado: a auditoria é read-only). Consequência para esta auditoria:
nenhuma afirmação sobre "os testes passam" pôde ser verificada por execução.

### 4.5 `.env.example` — ✅ fechado em 2026-08-20 (era 🟠 desde a auditoria de julho)

**Achado original (julho/2026), já resolvido antes desta sessão:** 6 variáveis declaradas em
`lib/env.ts` estavam ausentes do template (`IMPERSONATE_COOKIE_SECRET`, `INTERNAL_CRON_SECRET`,
`LGPD_SIGNING_KEY`, `LGPD_DPO_EMAIL`, `LGPD_EXPORT_EXPIRES_HOURS`, `NUVEMSHOP_ENABLED`).
Confirmado nesta sessão: as 6 já estão no `.env.example` atual — não sei quando foram
adicionadas, só que já não é gap.

**Achado "inverso" original (`FLYWHEEL_*`/`WATCHDOG_*` no template, ausentes de `lib/env.ts`):**
era descrito como "menos grave, sem validação Zod" — **incorreto**. Essas vars (mais
`CRON_STAGGER_WINDOW_MS`, `FOLLOWUP_MIN_AHEAD_MS`, `FOLLOWUP_MAX_AHEAD_MS`) são validadas por
Zod em `lib/agent-engine/env.ts`, um schema separado para o processo standalone do worker do
agent-engine — `lib/env.ts` é só o schema do processo Next.js. Não é gap; é fronteira de
processo correta, e a auditoria original não sabia da existência do segundo arquivo.

**Gap real, confirmado e fechado nesta sessão:** o mesmo padrão se repetia com o canal oficial
(Meta/WhatsApp Cloud API) — 6 vars (`META_APP_SECRET`, `META_WABA_ID`, `META_PHONE_NUMBER_ID`,
`META_SYSTEM_USER_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_VERSION`) já estavam no
template, mas eram lidas via `process.env.META_*` cru em 6 arquivos (3 rotas + 3 módulos de
`lib/channels/meta/`), sem passar pela validação de `lib/env.ts`. Adicionadas ao schema
(opcionais, mesmo padrão já usado para Nuvemshop) e os 6 call sites trocados para `env.META_*`.
`META_APP_ID` segue no template sem uso no código — mantido como nota informacional pro
self-hoster (aparece no painel de parceiros da Meta ao criar o app), não é gap de validação.
`scripts/spike-*.ts` e `tests/journeys/canal-oficial.spec.ts` continuam lendo `process.env`
direto de propósito — ferramentas fora do boot do app, não passam pela validação de produção.

Prova: `pnpm typecheck` limpo, `pnpm lint` limpo nos arquivos tocados, 58/58 testes unitários
relevantes (`meta-webhook*`, `send-template-wiring`, `meta-send-template*`) passando.

### 4.6 `ARCHITECTURE.md` tinha três afirmações falsas 🟡

Corrigidas nesta auditoria: dizia Next.js 15 (é 16.2), "rate limit sliding window"
(é fixed-window, e só em 2 pontos), e "`Idempotency-Key` para POSTs de criação" (existe
em **1** rota). Documentação que promete garantia inexistente é pior que documentação
ausente — um agente confia e não implementa.

### 4.7 Sem proteção automática contra vazamento de secret 🟡

Não há gitleaks/trufflehog no CI, nem pre-commit hook (`.husky`/`.pre-commit-config.yaml`
ausentes). `.gitignore` cobre `.env*` corretamente — a proteção é só essa camada.

### 4.8 ✅ Raiz do repositório — resolvido

Registrado porque a primeira passada desta auditoria apontou 11 PNGs de evidência
commitados na raiz. **Já foram movidos**: hoje há **zero** PNGs rastreados na raiz — a
evidência vive em `evidence/` (85, contando as subpastas), `docs/evidence/` (18) e
`loop/checkpoints/evidence/` (13) — **116** no total.
Dois HANDOFFs também migraram para `docs/handoffs/`. Restam 3 na raiz (`HANDOFF.md`,
`-harness-evolution`, `-operacao-visivel`), o que é consistente com "épico vivo fica visível,
épico encerrado é arquivado".

### 4.9 Divergências de estado nos HANDOFFs 🟡

`HANDOFF.md` afirma "Migration seguinte livre: **0058**" e lista pendência de aplicar `0057`
no dev DB — mas o repo já tem migrations até **0092**. São 34 migrations de deriva. É
consequência natural de trabalho em branches paralelas, mas ilustra a regra:
**HANDOFF não é fonte da verdade de schema** — `supabase/migrations/` e `baseline.sql` são.
**A CONFIRMAR:** se a pendência de dev DB de `0057` ainda existe.

### 4.10 Templates de e-mail e SMTP do Supabase Auth não sincronizam com `config.toml` 🔴 — corrigido no projeto de produção em 2026-08-19

Achado desta sessão, não coberto antes em nenhum doc. `supabase/config.toml` declara
`[auth.email.template.confirmation]`/`[auth.email.template.recovery]` apontando para
`supabase/templates/*.html` (que usam `?token_hash={{ .TokenHash }}&type=...`, o formato que
`app/auth/confirm/route.ts` espera). Isso só é aplicado automaticamente em `supabase start`
local. Um projeto hospedado (self-host na nuvem do Supabase, como o de produção deste app)
**não herda esses templates só por existirem no repo** — precisam ser colados manualmente em
Dashboard → Authentication → Emails → Templates, ou via `supabase config push` (que também
reescreveria `site_url` do projeto para `http://localhost:3000`, então não é o comando certo
para produção sem antes limpar as chaves não relacionadas a e-mail do `config.toml`).

**Sintoma quando isso está errado:** cadastro via `/signup` funciona, o e-mail chega
(especialmente depois de configurar SMTP customizado), o link confirma o e-mail (porque o
GoTrue hospedado processa `?code=` no próprio endpoint antes de redirecionar) — mas
`ensureTenantForUser()` nunca roda, porque a rota `/auth/confirm` só reconhece
`?token_hash=&type=`. O usuário loga normalmente depois e cai em "Você não tem nenhuma
organização ativa", sem nenhum erro nos logs do app (a falha acontece inteiramente do lado do
Supabase, antes do redirect chegar na rota).

Corrigido manualmente no Dashboard do projeto de produção nesta sessão. **Não há gate/teste que
detecte essa deriva automaticamente** — se o Supabase resetar os templates (recriação de
projeto, mudança de plano, etc.) ou um projeto novo for provisionado sem repetir esse passo
manual, o mesmo bug volta a acontecer silenciosamente. Candidato a runbook/checklist de deploy
(`docs/runbooks/deploy.md`) e possivelmente a um invariante de `test:e2e` que exercite o link
de confirmação real contra um projeto Supabase fresco.

Também descoberto nesta sessão, sem relação direta com o bug acima: o projeto de produção não
tinha SMTP customizado configurado (só o serviço default do Supabase, ~2 e-mails/hora) — bloqueio
de lançamento real, já que qualquer teste de reset de senha esgotava a cota. Configurado com
Resend (domínio `lumenva.pt`, já verificado) e testado com entrega real confirmada via API do
Resend.

---

## 5. Riscos técnicos abertos

1. **`createAdminClient` (service role, bypassa RLS) — 🟡 gate heurístico adicionado em
   2026-08-20, risco reduzido mas não eliminado.** O achado original (julho/2026: 89 dos 169
   handlers, sem enforcement automático na escrita) motivou `pnpm lint:tenant-filter`
   (`scripts/lint-tenant-filter.ts`, no `gov:verify`), mesma catraca do `lint:channels`: handler
   de `app/api/**/route.ts` com `createAdminClient` + query `.from()` direta + zero menção a
   `organization_id`/`organizationId` no arquivo reprova o merge.

   **O que isso prova e o que não prova** (documentado em
   `scripts/lint-tenant-filter.pattern.ts`): não é dataflow analysis — não confirma que o filtro
   usa o org CERTO, e não enxerga filtro feito dentro de um helper que recebe `orgId` como
   parâmetro (medido ao construir o gate: 4 dos 9 arquivos da primeira passada eram exatamente
   esse falso positivo — `ai/cases/route.ts` e `[id]/route.ts` delegam a `lib/escalacao/chamados.ts`,
   que filtra corretamente, só que num arquivo diferente do que o predicado lê). Pega só a classe
   mais simples e mais provável de erro: handler novo que esqueceu o `.eq()` de vez. Os 56 arquivos
   de invariante (RLS/schema) continuam sendo a prova real de isolamento; este gate é triagem na
   escrita, não substituto.

   3 arquivos em `KNOWN_DEBT` (lidos individualmente, não "provavelmente ok"): `admin/platform-admins`
   (único papel cross-tenant do contrato base), `system/update`+`system/agent`+`system/version`
   (dado de instalação self-host, não de tenant), `cron/attendant-heartbeat` (varredura
   system-wide documentada no próprio arquivo, AT-08). Nenhum é um vazamento — os 9 candidatos da
   heurística inicial foram todos lidos manualmente e nenhum é bug real.
2. **Fallback in-memory do rate limit** (`rate-limit.ts:23`): sem Upstash configurado — o
   estado normal de um primeiro deploy — o limite passa a ser por processo. Silencioso além
   de um `logger.warn`.
3. ✅ **`ffmpeg` na imagem** — era contingência aberta no HANDOFF; **resolvido**:
   `Dockerfile:55` faz `apk add --no-cache ffmpeg`, com comentário explicando que a derivação
   de vídeo roda no processo do app via o cron `event-log-drain`. Registrado como fechado.
4. **Dependência de credencial de terceiro para provar IA**: se Anthropic segue com credencial
   placeholder e Google com chave de gateway inválida, o caminho multimodal está provado em um
   único provider (OpenAI) apesar de o design ser model-agnostic. **A CONFIRMAR** se ainda vale.
5. **`lib/agent-engine/agent/inbound-turn.ts` com 1789 linhas** — 2,4× o segundo maior arquivo
   de lógica (`AgentForm.tsx`, 746), e é o hot path do produto. Cresceu ~200 linhas desde a
   primeira medição desta auditoria.

---

## 6. Perguntas para o responsável

1. Qual é a prioridade para "iniciar minimamente o sistema": fechar a Onda 8 de Follow-up,
   a prova de WhatsApp real que o épico do harness deixou aberta, ou estabilizar segurança
   (rate limit) antes de tudo?
2. A Fase FG (Vendaval) saiu de escopo? `G6.approved` existe e o README não a lista mais em
   "Próximo". `docs/vendaval-fusion-plan.md` e `docs/vendaval-vps-deploy-comandos.md` ainda valem?
3. Casos Humanos Wave 7 e Inbox Multimodal ondas 4–6 fecharam? Os HANDOFFs foram arquivados
   em `docs/handoffs/`, o que sugere sim, mas o texto interno ainda diz PARCIAL.
4. A credencial Anthropic e a chave direta do Google AI Studio foram providenciadas?
5. Os dois achados de produto registrados e não endereçados — transbordo a 390px e ausência
   de criação de funil — entram em qual momento? O primeiro é bug de primeira impressão mobile.
6. `pnpm gov:verify` deve passar a incluir `test:db` (exige Docker em toda máquina de dev)
   ou fica um `verify:full` separado?
7. As branch protection rules exigem os dois checks do CI verdes para merge? Isso decide se o
   gate de RLS é bloqueante ou decorativo.

---

## 7. Não pôde ser confirmado

- Se `pnpm typecheck` / `lint` / `test:unit` passam **hoje** — o `node_modules` deste checkout
  está incompleto e a auditoria não instala dependências.
- Se o job `invariants` do CI está passando — sabemos que existe, não que está verde.
- Se os E2E passam hoje — exigiriam Docker, banco e app rodando.
- Estado real do banco de dev/produção — nenhuma conexão foi aberta.
- Números de teste citados nos HANDOFFs (533 unit, 236 db, 547 unit em datas diferentes) —
  auto-relatados e não reconciliam entre si. Contei **221 arquivos** de teste unitário e
  **56** de invariante, compatível com mais de mil casos, mas não valida número específico.
- Cobertura de teste (%) — `coverage` está configurado no Vitest, mas nenhum relatório foi gerado.
- Se `docs/architecture/` cumpre o "mapa vivo" exigido pelo item 13 do DoD (contém só o
  diagrama do agent-turn).
- Estado de conclusão real dos épicos arquivados — ver pergunta 3.

---

## 8. Nota de método

A primeira passada desta auditoria rodou contra um checkout **556 commits atrás** da
`origin/main`, e por isso reportou como achado principal um problema (gate de RLS fora do CI)
que já estava corrigido em produção, e descreveu o épico de Evolução do Harness como "Fase 0,
Task 1" quando ele estava completo. Tudo acima foi recontado contra `origin/main @ 789dfa6`.

Duas lições que valem para quem mantiver este documento:

1. **`git fetch` antes de auditar.** A doutrina de higiene de branches do `CLAUDE.md` existe
   por isso; ignorá-la produziu um documento que desinformava com confiança.
2. **Este arquivo apodrece rápido.** O repo moveu 556 commits em poucos dias. Trate as datas
   do frontmatter como prazo de validade, não como enfeite — e prefira reconferir os números
   com os comandos citados a confiar na tabela.

---

## 9. Auditoria de branches (2026-08-19/20) — não reconta §1–§3, é levantamento à parte

Sessão dedicada a mapear toda branch local/`origin` fora da `main` e decidir destino: apagar
(já 100% mesclada) ou investigar por que não mergeou. `upstream/*` (fork de
`melgarafael/DeskcommCRM`) ficou fora do escopo — não são branches deste time.

### 9.1 Apagadas nesta sessão — já estavam 100% em `main`

`ai-platform-foundation` (local + `origin`), `fix/e2e-redis` (local), `feat/lumenva-website`
(local — o único commit pendente, troca de ícones do footer, foi conferido contra `main` e
achado **superado**: `main` já resolveu o mesmo problema de forma mais completa via
`LumenvaMark`/`socialIconMap` em `components/ui/BrandIcons`; o commit ficou preservado no
histórico da branch antes de apagar, não foi portado).

### 9.2 Mantidas — trabalho real, decisão pendente

| Branch | À frente de `main` | Situação |
|---|---|---|
| `ai-platform-gate` (local) | 3 commits | Fix isolado de race TOCTOU LGPD×Mem0 (`cd2b7249`, ver §4.10 nota anterior). Pequeno, testado, nunca teve PR aberto |
| `gpt-lumenva-content-os` (local) | 24 commits local / 7 no `origin` | **17 commits só no local, nunca pushados** — sistema de inteligência de conteúdo (providers RSShub/changedetection) em desenvolvimento ativo. Risco de perda se a máquina falhar antes de um `git push` |
| `agent-os-phase-7-durable-benchmark` (local + `origin`) | 235 commits | Sob auditoria ativa por sessão paralela nesta mesma janela; achados já confirmados: Fases 9/14 têm flag ligada sem rota HTTP por trás, Fase 7 (benchmark) incompleta, Fase 13 tinha teste especulativo |

### 9.4 Segunda rodada de limpeza (2026-08-20) — PRs de bot + duplicatas confirmadas

Apagadas por serem cópias exatas/ancestrais diretas de branches já mantidas, zero conteúdo
próprio, zero PR associado (conferido no repo certo, ver correção do §9.3):

- `origin/agent-os-phase-5-verification` — mesmo commit exato de `agent-os-phase-2-kernel`.
- `origin/agent-os-phase-7-durable-benchmark-planning` — ancestral direta de
  `agent-os-phase-7-durable-benchmark` (mantida), tudo que tinha já está contido nela.

Fechados dois PRs de dependency bump com 4+ checks falhando (`verify`/`e2e`/`build-and-size`/
`invariants`), sem relação com as branches acima:
[#24](https://github.com/trydavidqix/CRM/pull/24) (dependabot, 17 updates em grupo) e
[#21](https://github.com/trydavidqix/CRM/pull/21) (dependabot, `pdf-parse` 1.1.4→2.4.5, breaking
changes documentadas). O PR [#22](https://github.com/trydavidqix/CRM/pull/22) (seu, draft,
rastreando `agent-os-implementation-plan`) foi mantido aberto de propósito — é WIP real, não
lixo de bot.

### 9.3 Iniciativa "Agent OS" — 8 branches só no `origin`, quase nenhuma com PR, nenhuma mergeada

Todas nascem do plano `docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md`
(fases 1–9, cada `PLAN N.M` com seu próprio GO gate). Investigadas em paralelo por subagentes
Explore, um por branch/par, lendo só via `git show <branch>:<path>` (nenhum checkout).
Datadas todas de 17–18/08/2026.

**Correção (2026-08-20):** a varredura original de PR usou `gh pr list`/`gh pr view` sem
`--repo` explícito, e o `gh` resolveu contra o remoto `upstream` (`melgarafael/DeskcommCRM`,
o fork original) em vez do `origin` (`trydavidqix/CRM`, este repositório) — produzindo "nenhuma
teve PR" como conclusão errada. Refeito contra o repo certo: **duas das 8 tiveram PR**,
`agent-os-implementation-plan` → [PR #22](https://github.com/trydavidqix/CRM/pull/22)
("Agent OS Phase 1 foundation (draft)", ainda **OPEN**) e `agent-os-verification` →
[PR #23](https://github.com/trydavidqix/CRM/pull/23) ("Agent OS verification gate (draft, do
not merge)", **CLOSED**). As outras 7 seguem sem PR nenhum. Isso não muda o veredito técnico
de cada branch (código real vs. scaffolding, tabela abaixo) — só a afirmação sobre processo.

**Achado estrutural, contra a hipótese inicial:** não são 8 experimentos isolados sem relação
entre si — `agent-os-verification` é uma branch de "transporte" que acumula o código das fases
1–6 num único histórico contínuo (kernel + autonomia + memória + flywheel + guardrails +
playbooks coexistem na mesma árvore). O gate de cada fase historicamente rodou via preview
deploy manual na Vercel, nunca via GitHub Actions/CI — o PR #22 aberto e nunca fechado sugere
que a intenção de formalizar via PR existia, só não foi seguida adiante nas fases seguintes.

| Branch | Commits à frente | Veredito | Achado central |
|---|---|---|---|
| `agent-os-implementation-plan` (Fase 1 — Foundation 1.1–1.6) | 107 | **PARTIAL–REAL** | Contratos/testes substantivos (`lib/agent-engine/contracts/agent-os.ts`, 321 linhas + testes; golden dataset de 13 cenários real). Evidência cita SHAs e deployment ID da Vercel específicos, verificável contra a árvore. Mas o diff também **apaga** código de produção existente (workflows LangGraph de proposta/lead-scoring) — rip-and-replace nunca revisado |
| `agent-os-phase-2-kernel` (Fase 2 — Agent Kernel) | 164 | **PARTIAL** | Kernel real de 312 linhas (`lib/agent-engine/kernel/agent-kernel.ts`) com loop de execução completo (budget, retry, aprovação, idempotência), 30/30 arquivos de teste passando local. **Zero referência em `app/` ou `pages/`** — nenhuma rota/cron chama o kernel; código funcional e inerte |
| `agent-os-phase-3-product-agents` (Fase 3) | 194 | **PARTIAL** | 14 módulos de agente (`lib/agent-engine/product-agents/`) com validators determinísticos reais + wiring no kernel, testes substantivos (`agent-product-kernel-wiring.test.ts`). Mas **sem chamada de LLM e sem endpoint** — só scaffolding/contrato, nenhum agente roda de verdade |
| `agent-os-phase-4-shadow-evals` (+ `-planning`, ancestral direta) | 233 / 195 | **PARTIAL** | Infra de shadow-eval real (`lib/agent-engine/evals/`: runner, quality-judge, sampler, métricas) com ~14 arquivos de teste. A própria branch declara o critério de aceite real ("≥20 casos históricos por agente") como **"HISTORICAL PRODUCTION EVIDENCE NOT YET APPLICABLE"** — o CRM ainda não tem histórico suficiente pra avaliar de verdade |
| `agent-os-phase-5-assisted-autonomy` | 203 | **PARTIAL** | Autonomia real: kill-switch em cascata, máquina de estados de aprovação, escada de promoção (`off → shadow → draft → assisted → autopilot_*`) que nega auto-promoção pelo próprio modelo. Evidência honesta: o próprio doc admite rodar só localmente ("no GitHub Actions and no Vercel Preview deployment were used"), nunca em CI/ambiente compartilhado |
| `agent-os-phase-5-verification` | 164 | **✅ apagada (§9.4)** | Confirmado: mesmo commit exato de `agent-os-phase-2-kernel` (`8ff7c402`). Alias morto, sem trabalho próprio |
| `agent-os-phase-6-learning-flywheel` | 278 | **PARTIAL** | Flywheel real e testado (`lib/agent-engine/flywheel/*`, 17 arquivos de teste). **Colisão confirmada e não-trivial** com o Flywheel já mergeado em `main` (Fase 10, `docs/current-state.md` §2): ambos leem/escrevem `flywheel_distiller_proposals`, e a migration desta branch reabre a mesma `check constraint` que `main` já alterou duas vezes por outro caminho. Migration nunca rodou contra banco real. Sem flag em `ai_platform_feature_flags` |
| `agent-os-verification` | 252 | **PARTIAL** | Não é fase isolada — é a branch "transporte" cumulativa das fases 1–6 (ver achado estrutural acima). O marcador específico de "Fase 6 verificada" é um commit de 3 linhas sem output de comando anexado — self-report puro para esse ponto específico, ainda que fases anteriores (1/1.5/1.6) tenham evidência mais concreta na mesma árvore |
| `agent-os-phase-7-durable-benchmark-planning` | 111 | **✅ apagada (§9.4)** | Só design doc + 1 teste propositalmente falhando (RED puro, `tests/unit/durable-benchmark-contracts.test.ts` importa um módulo que não existe nesta branch). Era ancestral direta de `agent-os-phase-7-durable-benchmark` (mantida — §9.2), que tem a implementação de verdade |

**Padrão geral:** diferente do pior caso já visto nesta investigação (flag ligada em produção
sem rota nenhuma por trás — ver o achado da outra sessão sobre Fases 9/14 no §9.2), o padrão
aqui é **engenharia real, testada localmente, nunca integrada** — nenhuma rota de produção
chama esse código, nenhuma passou por CI, uma delas (Fase 6) colide de fato com algo que já
está em produção. Decisão do dono do repo: manter as 8 branches como estão por enquanto
(R&D válido, mas nenhuma pronta pra virar PR sem rebase + trabalho de integração real).

---

## 10. GitHub Actions desabilitado (decisão permanente, 2026-08-20)

Gatilho: os checks de CI do PR #25 vieram todos `FAILURE` em 4 segundos — tempo rápido demais
pra falha de teste real. Investigado via `gh run view --repo trydavidqix/CRM`: a anotação real
era `"The job was not started because recent account payments have failed or your spending
limit needs to be increased"` — billing da conta GitHub quebrado, não código. **Isso também
lança dúvida retroativa sobre os PRs #21 e #24, fechados horas antes com "checks falhando"
como justificativa** — pode ter sido o mesmo problema de billing, não falha real de teste; não
foi reaberto porque o conteúdo de ambos (dependency bumps major com breaking changes) já era
descartável por outros motivos, mas o veredito "falhou no CI" especificamente não deve ser
tratado como confiável para decisões anteriores a esta data.

Decisão do dono do repo, dado o cenário: **desabilitar GitHub Actions inteiro,
permanentemente** — não só até resolver o billing. Aplicado via
`PUT repos/trydavidqix/CRM/actions/permissions {"enabled": false}` (configuração de repositório,
não arquivo — continua valendo mesmo se `ci.yml`/`e2e.yml`/`perf.yml`/`publish-image.yml` forem
editados ou um workflow novo for adicionado). Verificado via `GET` do mesmo endpoint:
`{"enabled": false}`.

**Consequências documentadas nesta sessão:**

- `docs/runbooks/deploy.md` reescrito: o caminho que era "exceção" (build direto na VPS) virou
  o único caminho — `publish-image.yml` não publica mais imagem no GHCR automaticamente.
- `.claude/rules/testing-verification.md` ganhou seção própria: verificação local
  (`typecheck`/`lint`/`test:unit`/`test:db` quando aplicável) e Vercel Preview passam a ser a
  prova primária, não complemento ao CI.
- Nova política de cadência, também registrada em `.claude/rules/testing-verification.md`:
  tarefa com subtasks só dispara Vercel Preview na última etapa, não a cada subtask — reforça a
  política pré-existente sobre a cota de 100 previews/24h, agora sem CI cobrindo builds
  intermediários.

**Não investigado nesta sessão:** a causa raiz do billing quebrado (forma de pagamento
vencida, limite de gasto atingido, etc.) — é ação de conta que só o dono resolve em
Settings → Billing & plans do GitHub, e ficou sem efeito prático já que a decisão foi desligar
Actions em vez de consertar o billing.
