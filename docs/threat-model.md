---
type: threat-model
project: DeskcommCRM
status: maintained (reconciled; exploitability still not live-tested)
last_updated: 2026-09-22
generated_by: auditoria documental sincronizada — leitura de rotas, guards, proxy.ts e lib/env.ts
confidence: média-alta (superfície e guards são CONFIRMADO por leitura de código; explorabilidade é INFERIDO — nada foi testado contra instância viva)
audited_against: codex/crm-consolidated @ 54e86839 (2026-08-28)
---

# Threat model — DeskcommCRM self-host

Complementa [`SECURITY.md`](../SECURITY.md), que é política de *reporte*. Este documento é
o inventário da **superfície de ataque real**: o que fica exposto quando alguém sobe o
DeskcommCRM numa VPS com IP público.

**Modelo de implantação que muda tudo:** o produto é self-host open-source. O atacante
tem o **código-fonte completo** — conhece cada rota, cada nome de env var, cada fallback.
Segurança por obscuridade vale zero aqui. E o operador é tipicamente uma PME sem equipe
de segurança: um default inseguro não vai ser corrigido por ele.

**Nada aqui foi explorado.** Nenhum ataque foi executado, nenhuma instância foi tocada.
São conclusões de leitura de código.

---

## 1. Superfície exposta sem sessão

`lib/auth/public-paths.ts` define o que passa sem checagem de auth no `proxy.ts`
(middleware do Next 16). CONFIRMADO:

| Path | Guard próprio dentro da rota | Rate limit |
|---|---|---|
| `/`, `/login`, `/signup`, `/auth/confirm` | Supabase Auth | ❌ |
| `/team/accept-invite/:token` | HMAC-SHA256 + `timingSafeEqual` (`lib/auth/invite-token.ts`) | ❌ |
| `/api/v1/health` | nenhum (por design) | ❌ |
| `/api/v1/webhooks/waha/*` | HMAC-SHA512 + `timingSafeEqual` (`lib/waha/ingest.ts`) | ✅ 120/min por sessão |
| `/api/v1/webhooks/in/:token` | path token + assinatura opcional | ✅ 60/min por token |
| `/api/v1/webhooks/meta/*` | HMAC + Zod envelope | ✅ 120/min por sessão |
| `/api/v1/webhooks/nuvemshop/*` | HMAC + Zod/event validation | ✅ 30–60/min por loja |
| `/api/v1/cron/*` (9 rotas) | `Bearer INTERNAL_CRON_SECRET\|INTERNAL_SECRET`, **fail-closed** | ❌ |
| `/api/internal/*` | `x-internal-secret` ou `Bearer INTERNAL_SECRET`, comparação em tempo constante | ❌ |
| `/api/mcp` | `Bearer dsk_...` validado contra `api_tokens` (hash SHA256) | ✅ 30 falhas/60s por endereço antes do lookup; 120/min por organização após auth |
| `/account-suspended`, `/403`, `/404`, `/500`, `/503`, `/admin/forbidden` | — | ❌ |

**Leitura:** a autenticação de cada superfície está bem construída — HMAC com
`timingSafeEqual` em 6 módulos distintos, crons fail-closed, bearer só via header
(nunca query string), plaintext do token nunca persistido. O MCP agora consulta o
contador de falhas antes do lookup em `api_tokens` e registra somente respostas 401;
o limite de organização continua depois da autenticação.

---

## 2. Riscos por ordem de exploração

### T1 — Rate limit incompleto nas superfícies públicas 🟠 RECONCILIADO EM 2026-09-22

O achado original dizia que `checkRateLimit` só existia em dois pontos. Isso já não
descreve a árvore atual: auth/API sensíveis e os webhooks públicos Meta, WAHA e Nuvemshop
têm limites próprios, aplicados antes do ingest pesado. Os sete receivers que estavam sem
proteção foram corrigidos em `3c3e2d73`.

Continuam sem rate limit dedicado, por decisão ou por lacuna residual:

- **`/login`** — não existe lockout por conta; a proteção atual é o limite de request.
  Senha fraca de operador continua atacável com IPs rotativos.
- **`/signup`** — criação de organização em massa; num self-host multi-tenant isso é
  exaustão de recurso (e de cota de IA, se as chaves forem da instância).
- **`/team/accept-invite/:token`** — o HMAC é forte, mas sem limite o atacante pode
  sondar indefinidamente e sem custo, e sem gerar sinal de alerta.
- **Os 10 crons e `/api/internal/*`** — o secret é forte e a comparação é em tempo
  constante, mas nada limita o volume de tentativas.
- **`/api/mcp`** — enumeração de bearer token é limitada a 30 falhas/60s por endereço
  identificável antes do lookup; se o runtime não expõe endereço, não há balde global
  (para não transformar tentativas falsificadas em DoS compartilhado).

**Mitigação residual:** confirmar em cada instalação que Redis distribuído está configurado
e que o proxy/runtime preserva o endereço do cliente para o MCP; decidir se login/convite
precisam de limite adicional por identidade, não só por request.

### T2 — Fallback in-memory do rate limit anula o limite que existe 🟠 CONFIRMADO

`lib/ai/dispatcher/rate-limit.ts:23` — sem `UPSTASH_REDIS_REST_URL`/`_TOKEN` o contador cai
para um `Map` em memória do processo. Consequências:

- É o estado **normal de um primeiro deploy** (Upstash é serviço externo; `lib/env.ts:69`
  trata as duas vars como opcionais em dev e obrigatórias só em produção).
- Multi-instância ou multi-worker ⇒ limite por processo, não por tenant.
- O único sinal é um `logger.warn` uma vez por processo. Um operador de PME não vai ver.

O stack de produção do kit inclui `serverless-redis-http` + Redis local (visto em
`docker-compose.prod.yml`), o que resolve — **A CONFIRMAR** se o `install.sh` garante que
essas duas vars ficam populadas em toda instalação.

### T3 — handlers com service role e gate heurístico 🟠 CONFIRMADO

`createAdminClient` (service role, **bypassa RLS**) aparece em muitos route handlers de
`app/api/**`. A regra da doutrina —
"filtre `organization_id` manualmente, resolvido de fonte
confiável, nunca do body" — é aplicada por revisão humana. Desde 2026-08-20 existe
`pnpm lint:tenant-filter`, um gate heurístico que reprova o caso simples de handler novo
com client admin e nenhuma menção ao tenant; ele não substitui dataflow review nem os
invariantes RLS.

Este é o **pior modo de falha do produto**: vazamento cross-tenant. Duas mitigações reais
existem: as amostras que li (`admin/tenants`, `webhooks/in/:token`, `team/:user_id`) seguem o
padrão corretamente, e os **78 arquivos de invariante em `tests/invariants/` são a prova
local do isolamento cross-tenant**; GitHub Actions está inativo, portanto o job histórico
`invariants` não é executado automaticamente. O
guard-rail existe **e está ligado** — rebaixei de 🔴 para 🟠 por isso.

**Lacuna residual:** os invariantes provam que os caminhos cobertos isolam; não impedem que
um handler novo nasça sem filtro e sem invariante correspondente.

**Mitigação residual:** manter o gate heurístico e acrescentar invariantes para handlers
novos; a análise não é dataflow e pode deixar passar um filtro incorreto.

### T4 — Secret de convite com fallback conhecido 🟠 CONFIRMADO no código, mitigado na prática

`lib/auth/invite-token.ts:16`:

```
INVITE_TOKEN_SECRET → INTERNAL_SECRET → "dev-fallback"
```

Se a cadeia chegar em `"dev-fallback"`, qualquer pessoa com o repo público forja um token
de convite válido — payload inclui `organization_id` e `role`, ou seja: **admin em qualquer
org**.

**Mitigação existente:** `INTERNAL_SECRET` é `required()` em `lib/env.ts:47`, que em
`NODE_ENV=production` **derruba o boot** se estiver vazio. Então numa instância de produção
que subiu, o fallback é inalcançável (INFERIDO — depende de o self-host rodar com
`NODE_ENV=production`, o que é o esperado com `next start`).

**Residual:** (a) em dev a validação afrouxa e a var vira `""` — e string vazia é falsy,
então cai no `"dev-fallback"`; (b) `invite-token.ts` lê `process.env` **cru**, contornando
o Zod, então não herda garantia nenhuma; (c) `INVITE_TOKEN_SECRET` não existe em
`lib/env.ts` nem em `.env.example`, só em docs de épico.
Já está rastreado pelo projeto como risco **M4** em `docs/testing/user-journey-map.md` —
crédito onde é devido.

**Mitigação recomendada:** eliminar o literal. Falhar alto (`throw`) quando nenhum secret
existe, em vez de degradar para um valor público.

### T5 — Secrets ausentes do `.env.example` 🟠 CONFIRMADO

`IMPERSONATE_COOKIE_SECRET`, `INTERNAL_CRON_SECRET`, `LGPD_SIGNING_KEY` estão em
`lib/env.ts` e **não** no template. O operador não sabe que precisa gerá-los.

Como são `required()` (obrigatórios só em produção), o efeito mais provável é falha de boot
com mensagem clara — que é o comportamento seguro. O risco real é indireto: instalação
frustrada, operador colando valor fraco ("123456") só para o app subir, ou reaproveitando
o mesmo valor em todos.

### T6 — SSRF em webhook de saída 🟢 MITIGADO — CONFIRMADO

`lib/automation/outbound-url.ts` + `outbound-url.test.ts` + `lib/automation/actions/call-webhook.ts`
implementam guard de URL de saída, e existe E2E dedicado
(`tests/e2e/vps-webhook-outbound-ssrf.spec.ts`). É a defesa mais bem feita do repo.

**Ressalva:** esse E2E **não roda no CI** — e é a única prova automatizada do guard.
`outbound-url.test.ts` é unitário e roda, o que cobre a lógica de decisão; o que não roda é a
prova de que o egress real está barrado ponta a ponta. Uma regressão na integração passa.

### T7 — Sem varredura de secret no histórico git 🟡 CONFIRMADO

Sem gitleaks/trufflehog no CI, sem pre-commit hook (`.husky` e `.pre-commit-config.yaml`
ausentes). `.gitignore` cobre `.env*` corretamente, e essa é a única camada.

Agravante específico deste repo: a doutrina de QA visual **incentiva commitar evidência
visual**, e há **116 PNGs rastreados** (85 em `evidence/` contando subpastas, 18 em
`docs/evidence/`, 13 em `tooling/agent-loop/checkpoints/evidence/`). Screenshot de tela autenticada pode conter telefone, nome de
cliente ou token em URL — e várias evidências são explicitamente descritas nos HANDOFFs como
tiradas em **conta e conversa reais de WhatsApp**. Num repo público, é irreversível.

Não é argumento contra a doutrina de evidência visual, que é boa. É argumento para um passo
de revisão de PII antes do commit — e `gitleaks` não pega isso, porque não lê imagem.

### T8 — Onde a auditoria é cega ⚪ NÃO IDENTIFICADO

Não avaliado por falta de execução/instância:

- Se as políticas RLS **realmente** isolam (os invariantes existem para provar; não foram rodados).
- Postura do container WAHA — `docker-compose.prod.yml` comenta "Core por default, dashboard
  off", mas exposição de porta e rede não foram verificadas contra instância viva.
- Config do Caddy (`Caddyfile`) — TLS, headers de segurança, HSTS.
- Se `next.config.ts` define CSP / security headers.
- Storage: se o bucket `whatsapp-media` está privado de fato e se a expiração das signed
  URLs é adequada.
- Escopo do service role key no Supabase e rotação de chaves.
- Efetividade do `beforeSend` do Sentry contra PII real.

---

## 3. Sumário de prioridade

| # | Risco | Sev | Custo do fix |
|---|---|---|---|
| T1 | Sem rate limit em login/signup/convite/crons/MCP | 🔴 | baixo — infra já existe |
| T2 | Rate limit degrada silenciosamente para memória | 🟠 | baixo |
| T3 | Service role sem gate de escrita para handler novo | 🟠 | médio (lint rule) — invariantes cobrem quando executados localmente |
| T4 | `"dev-fallback"` como secret de convite | 🟠 | trivial |
| T5 | 3 secrets fora do `.env.example` | 🟠 | trivial |
| T7 | Sem scan de secret no CI + 116 PNGs de evidência sem revisão de PII | 🟡 | baixo |
| T6 | Guard de SSRF existe; o E2E que o prova não roda no CI | 🟢 | baixo |

**Conclusão honesta:** os *mecanismos* de segurança deste projeto são acima da média para
um CRM open-source — HMAC em tempo constante em toda borda, fail-closed nos crons, hash de
bearer, RLS com helper central, guard de SSRF testado, RGPD implementado de verdade,
`beforeSend` higienizando PII, e **78 arquivos de invariante de isolamento para execução
local**.

O que falta é estreito e específico: confirmar Redis distribuído em cada instalação e,
se necessário, adicionar limite por identidade em login/convite. Não há prova de exploração
ao vivo nesta auditoria.

---

## 4. Perguntas para o responsável

1. O `install.sh` garante `UPSTASH_REDIS_REST_URL`/`_TOKEN` populados em toda instalação?
   (decide a severidade de T2)
2. Alguma instância de produção já rodou sem `INTERNAL_SECRET` definido? (decide se T4 já
   foi exposto em campo)
3. Os 116 PNGs de evidência foram revisados quanto a PII antes do commit? Vários são
   descritos como tirados em conta e conversa reais de WhatsApp.
4. Existe branch protection exigindo os dois checks do CI verdes no merge? (não é visível
   no checkout)
5. Há intenção de pedir pentest externo antes de divulgar a v1.0.0 mais amplamente?
