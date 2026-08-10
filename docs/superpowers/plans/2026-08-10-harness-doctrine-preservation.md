# Harness Doctrine Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preservar semanticamente toda doutrina válida do `CLAUDE.md` original enquanto mantém o harness modular criado em `gpt-harness-convergence`.

**Architecture:** `CLAUDE.md` permanece autoridade e entrada curta o suficiente para navegação; `.claude/rules/` guarda detalhes normativos por domínio. Uma matriz de reconciliação prova o destino de cada grupo de regra antiga, e o checker determinístico impede que domínios críticos ou links estruturais desapareçam.

**Tech Stack:** Markdown, Node.js 22, pnpm, GitHub Actions.

## Global Constraints

- Trabalhar somente na branch `gpt-harness-convergence`.
- Não alterar `main`.
- Não tocar em Supabase/schema/migrations nem código de produto em `app/`, `lib/`, `components/`, `workers/`.
- Não tocar em Vercel, WAHA, Redis, Docker, produção, credenciais ou dados reais.
- Não alterar a branch `gpt-ai-platform`.
- Não alterar comportamento de `gov-loop`, `triagem-*` ou `.codex/agents/*.toml`.
- Não versionar `.claude/settings.json`.
- Não criar dependência externa nova.
- `CLAUDE.md` original em `main@4fa4ca9a7042b88d6de35e411e4375213fb26d93` é baseline histórico; specs/PRDs/business-rules/doctrine atuais têm precedência quando houver divergência documentada.
- Métricas, contagens, SHAs e estados de CI/épicos são snapshots, não doutrina eterna.

---

### Task 1: Construir a matriz de reconciliação da doutrina

**Files:**
- Create: `docs/harness-doctrine-matrix.md`

**Interfaces:**
- Consumes: `CLAUDE.md` da `main@4fa4ca9...`, `docs/specs/`, `docs/prd/`, `docs/business-rules/`, `docs/doctrine/`.
- Produces: tabela com `Regra original | Classificação | Fonte atual | Destino novo | Estado/nota`.

- [ ] **Step 1:** Inventariar os grupos normativos do `CLAUDE.md` original: stack estável; tenancy; idempotência/event sourcing; API; auth/RBAC; audit; LGPD; WAHA; DIRC/modelagem; anti-patterns; deploy; QA visual; Git; migrations; skills; DoD.
- [ ] **Step 2:** Classificar cada grupo como `ESTÁVEL`, `SNAPSHOT` ou `DIVERGENTE` com uma fonte atual explícita.
- [ ] **Step 3:** Registrar divergências conhecidas sem escolher pelo texto antigo quando a spec já decidiu diferente; exemplo obrigatório: super-admin usa `platform_admins` na Spec 01, não uma coluna normativa `is_platform_admin` em `auth.users`.
- [ ] **Step 4:** Mapear cada regra estável para `CLAUDE.md`, uma rule específica ou um doc canônico explicitamente linkado.
- [ ] **Step 5:** Confirmar que contagens de testes/handlers/E2E e estado de branch protection ficam fora da doutrina estável.
- [ ] **Step 6:** Salvar a matriz com nenhuma linha normativa válida em estado `sem destino`.

### Task 2: Restaurar contrato API, idempotência, audit e observabilidade

**Files:**
- Create: `.claude/rules/api-contract.md`
- Create: `.claude/rules/audit-observability.md`

**Interfaces:**
- Consumes: Spec/PRD 01 e catálogo de business rules.
- Produces: contrato normativo detalhado para `/api/v1/`, idempotência, tokens, rate limit, request IDs, audit append-only e retenção.

- [ ] **Step 1:** Em `api-contract.md`, registrar versionamento por path, JSON `snake_case` apenas na API, UUID v4, ISO-8601 UTC, `_cents` + `currency`, wrappers `ok()`/`fail()`, cursor HMAC, auth cookie/bearer e API key fora de query string.
- [ ] **Step 2:** Preservar `Idempotency-Key: <uuid>` em POST de criação com TTL 24h e conflito 409 quando o body divergir, conforme PRD/Spec 01.
- [ ] **Step 3:** Preservar headers `X-RateLimit-*`, `Retry-After` e `X-Request-Id` quando aplicáveis.
- [ ] **Step 4:** Em `audit-observability.md`, registrar `api_audit_log` append-only, mutações relevantes, falha de write que alerta sem bloquear a mutação, p99 de até 500ms como requisito documentado e retenção 5 anos/90 dias hot/cold conforme fonte atual.
- [ ] **Step 5:** Registrar proibição de PII/secrets em logs e o papel de Sentry/logger sem depender só de sanitização posterior.

### Task 3: Restaurar LGPD e Auth/RBAC sem reintroduzir decisão superada

**Files:**
- Create: `.claude/rules/lgpd.md`
- Modify: `.claude/rules/security.md`
- Modify: `.claude/rules/multi-tenancy.md`

**Interfaces:**
- Consumes: PRD/Spec 01, Spec 02/06 e business rules L/T.
- Produces: LGPD detalhada e Auth/RBAC atualizados.

- [ ] **Step 1:** Em `lgpd.md`, preservar anonimização preferida, delete físico raro, cascade, irreversibilidade, consentimento granular, audit de dados sensíveis e ações canônicas LGPD.
- [ ] **Step 2:** Preservar SLA D+7 dias úteis para export e D+15 dias úteis para redact, conforme fontes atuais.
- [ ] **Step 3:** Preservar remoção de mídia/PII e manutenção de histórico/timestamps conforme contratos atuais.
- [ ] **Step 4:** Em `security.md`, tornar explícitos MFA TOTP obrigatório para `admin` e platform admin, `getUser()` server-side, tokens fora de query string e plaintext de bearer não persistido.
- [ ] **Step 5:** Em `multi-tenancy.md`, representar super-admin pela abstração/tabela `platform_admins` da Spec 01 e registrar que é o único papel cross-tenant; não reintroduzir `is_platform_admin` como coluna canônica.
- [ ] **Step 6:** Registrar `user_pipeline_access` como fora do MVP somente se a fonte vigente continuar dizendo isso; a matriz deve apontar a fonte.

### Task 4: Restaurar WAHA e modelagem com precisão de domínio

**Files:**
- Create: `.claude/rules/whatsapp-waha.md`
- Create: `.claude/rules/data-modeling.md`

**Interfaces:**
- Consumes: PRD/Spec 03, Spec 02 e catálogo W/P.
- Produces: regras normativas específicas que não cabem no `CLAUDE.md` principal.

- [ ] **Step 1:** Em `whatsapp-waha.md`, preservar Plus/NOWEB, auth SHA512/plaintext, HMAC timing-safe, mídia via Storage, `message.any`, `fromMe`, grupos e idempotência `(organization_id, external_id)`.
- [ ] **Step 2:** Preservar anti-banimento: 1 msg/1.2s + jitter até 800ms, campanha 1/5s, warm-up 7–14 dias, janela 7h–22h, domingo evitado por default, limites e spinning conforme PRD/business rules.
- [ ] **Step 3:** Preservar STOP com a versão vigente da regex/regra — incluir `CANCELAR` porque a fonte atual é mais específica que o texto antigo.
- [ ] **Step 4:** Documentar o comportamento vigente de `recover-stuck-messages` sem transformar snapshot de implementação em regra se o runbook/código atual divergir; a matriz registra a fonte usada.
- [ ] **Step 5:** Em `data-modeling.md`, preservar DIRC, 5 tabelas core, fractional indexing, `external_id` nullable, regras de vocabulário/check constraint, `tags`/GIN, `custom_fields` e `vocabulary` por pipeline quando confirmados.
- [ ] **Step 6:** Preservar anti-patterns arquiteturais do original e separar de exemplos que envelhecem.

### Task 5: Reconciliar `CLAUDE.md` com as rules completas

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: entrada canônica com links para todas as 13 rules e invariantes transversais sem perda semântica.

- [ ] **Step 1:** Adicionar `api-contract.md`, `audit-observability.md`, `lgpd.md`, `whatsapp-waha.md` e `data-modeling.md` ao índice de rules obrigatórias.
- [ ] **Step 2:** Manter no arquivo principal invariantes de tenancy, auth, schema triplo, trigger sem HTTP, idempotência, audit, segurança, self-host e provider boundary.
- [ ] **Step 3:** Restaurar precisão crítica por ponteiros explícitos: API/idempotência, audit, LGPD, WAHA e modelagem não podem ficar apenas com frases genéricas.
- [ ] **Step 4:** Corrigir qualquer regra antiga divergente conforme matriz; não restaurar `is_platform_admin` como coluna se a Spec 01 atual define `platform_admins`.
- [ ] **Step 5:** Manter comandos canônicos em `pnpm` e distinguir `gov:verify` de `test:db`/`test:e2e`.
- [ ] **Step 6:** Manter DoD original semanticamente coberto e conservar os itens novos de harness/diff; não promover contagens ou estado temporal ao DoD.

### Task 6: Atualizar pontes portáteis e runbook sem duplicar doutrina

**Files:**
- Modify: `AGENTS.md`
- Modify: `.claude/skills/DeskcommCRM/SKILL.md`
- Modify: `.agents/skills/DeskcommCRM/SKILL.md`
- Modify: `.codex/AGENTS.md`
- Modify: `docs/runbooks/agent-harness.md`

**Interfaces:**
- Consumes: árvore final de rules.
- Produces: todas as plataformas apontando para a mesma autoridade e para os novos domínios.

- [ ] **Step 1:** Atualizar `AGENTS.md` para citar as cinco rules novas sem copiar seus detalhes.
- [ ] **Step 2:** Atualizar as duas skills DeskcommCRM com a lista completa de rules e manter a declaração de não-autoridade.
- [ ] **Step 3:** Atualizar `.codex/AGENTS.md` apenas nos ponteiros necessários; credenciais/MCPs privados continuam locais.
- [ ] **Step 4:** Atualizar o runbook com a árvore de 13 rules, processo de reconciliação e matriz documental.
- [ ] **Step 5:** Não alterar agents especializados, gov-loop ou triagem.

### Task 7: Ampliar `harness:check` com TDD

**Files:**
- Modify: `scripts/check-harness-consistency.test.mjs`
- Modify: `scripts/check-harness-consistency.mjs`

**Interfaces:**
- Produces: `checkHarnessConsistency(rootDir)` exigindo as 13 rules e seus links em `CLAUDE.md`.

- [ ] **Step 1: RED:** adicionar as cinco rules ao fixture saudável e testes que removem uma rule crítica (`lgpd.md`) e removem seu link do `CLAUDE.md`; o checker atual deve falhar em detectar pelo menos um desses novos requisitos.
- [ ] **Step 2: GREEN:** ampliar `REQUIRED_RULES` para incluir `api-contract.md`, `audit-observability.md`, `lgpd.md`, `whatsapp-waha.md`, `data-modeling.md`.
- [ ] **Step 3:** Adicionar teste para exigir que `docs/harness-doctrine-matrix.md` exista e contenha as classificações `ESTÁVEL`, `SNAPSHOT` e `DIVERGENTE`.
- [ ] **Step 4:** Implementar finding `missing-doctrine-matrix`/`incomplete-doctrine-matrix` sem tentar interpretar equivalência semântica completa.
- [ ] **Step 5:** Rodar `node --test scripts/check-harness-consistency.test.mjs`; esperado: todos os testes passam.
- [ ] **Step 6:** Rodar `node scripts/check-harness-consistency.mjs`; esperado: exit 0 na árvore final.

### Task 8: Atualizar documentação e handoff da iniciativa

**Files:**
- Modify: `docs/runbooks/agent-harness.md`
- Modify: `docs/superpowers/specs/2026-08-10-harness-doctrine-preservation-design.md` apenas para status final, se necessário
- Create: `docs/superpowers/handoffs/2026-08-10-harness-doctrine-preservation.md`

**Interfaces:**
- Produces: evidência humana do que foi preservado, reconciliado e não medido.

- [ ] **Step 1:** Registrar as divergências realmente encontradas e a fonte vencedora.
- [ ] **Step 2:** Registrar que a matriz é a prova documental de cobertura e o checker é apenas prova estrutural.
- [ ] **Step 3:** Registrar testes executados e suas saídas quando disponíveis.
- [ ] **Step 4:** Registrar explicitamente que carregamento real de Claude Code/settings/hooks locais continua dependente da estação.

### Task 9: Verificação final e escopo da branch

**Files:** todos os arquivos alterados na iniciativa.

- [ ] **Step 1:** Comparar `main...gpt-harness-convergence`.
- [ ] **Step 2:** Confirmar ausência de mudanças em `app/`, `lib/`, `components/`, `workers/`, `supabase/` e infraestrutura de produção fora de arquivos de harness/CI já autorizados.
- [ ] **Step 3:** Confirmar que `gov-loop`, `triagem-*` e `.codex/agents/*.toml` não mudaram funcionalmente.
- [ ] **Step 4:** Confirmar que `.claude/settings.json` permanece não versionado.
- [ ] **Step 5:** Confirmar que as 13 rules existem e `CLAUDE.md` aponta para todas.
- [ ] **Step 6:** Revisar a matriz para nenhuma regra normativa válida do baseline ficar sem destino/justificativa.
- [ ] **Step 7:** Manter a branch separada, sem PR e sem merge para `main`.

## Self-review

- Spec coverage: todas as áreas explicitamente pedidas — API/idempotência, audit, LGPD, Auth/RBAC, WAHA, modelagem, snapshots, matriz e gate — têm task própria.
- Placeholder scan: nenhuma etapa depende de `TBD`/`TODO` ou instrução vaga de implementação.
- Interface consistency: `REQUIRED_RULES` e a árvore documentada usam os mesmos 13 nomes.
- Scope: nenhuma task autoriza alteração de código de produto, banco ou produção.
