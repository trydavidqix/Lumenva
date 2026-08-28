---
type: harness-audit
project: DeskcommCRM
status: maintained (historical audit with current verification policy)
last_updated: 2026-08-28
generated_by: auditoria documental sincronizada — verificação de arquivos, configs e política de execução
confidence: alta (todos os itens verificados por leitura direta de arquivo/config; nenhum comando executado)
audited_against: codex/crm-consolidated @ 54e86839 (2026-08-28)
---

# Auditoria do harness — DeskcommCRM

"Harness" = a infraestrutura que permite a um humano ou agente instalar, entender,
alterar e **verificar** o projeto com segurança. Um harness fraco não impede o trabalho;
ele torna o trabalho não-verificável, e é aí que a regressão entra sem ninguém ver.

Nada aqui foi executado — a auditoria é read-only por instrução. Todos os itens foram
verificados por leitura de arquivo, config e workflow.

**Correção (2026-08-20): GitHub Actions foi desabilitado, permanentemente, decisão do dono do
repositório** (`repos/{owner}/{repo}/actions/permissions` → `enabled: false`; detalhe em
`docs/current-state.md` §10). Toda afirmação abaixo que descreve algo "rodando no CI" —
`ci.yml`, `e2e.yml`, `perf.yml`, `publish-image.yml`, os jobs `verify`/`invariants` — descreve
um estado que **não é mais verdade**: os workflows continuam no repo mas estão inertes, não
disparam em push/PR/manual. Não reescrevi item por item porque a maioria das afirmações abaixo
já era stale desde julho por outros motivos (ver `audited_against`); trate qualquer menção a CI
neste documento como histórico, não como comportamento atual. Verificação hoje é local
(`pnpm typecheck && pnpm lint && pnpm test:unit`, `pnpm test:db` quando aplicável) + Vercel
Preview no fim da tarefa — `.claude/rules/testing-verification.md` tem o detalhe atual.

---

## Nível de maturidade: **H4 — Preparado para agentes**

| Nível | Veredito | Evidência |
|---|---|---|
| H0 — Não documentado | superado | 211 docs em `docs/`, README em 3 idiomas, PRDs, specs, `CHANGELOG.md` |
| H1 — Documentado | ✅ | `README.md`, `ARCHITECTURE.md`, `VISION.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` (Keep a Changelog + SemVer) |
| H2 — Reproduzível | ✅ | Quickstart no README, `docs/SETUP.md`, `.nvmrc` (22), `packageManager` fixo, `pnpm-lock.yaml`, `docker-compose.yml`, `install.sh` do kit self-host, `baseline.sql` |
| H3 — Verificável | ✅ | `lint` + `typecheck` + `test:unit` + `build`; execução local documentada e workflows versionados (Actions inativo) |
| H4 — Preparado para agentes | ✅ | `CLAUDE.md` doutrinal forte; `AGENTS.md` **criado nesta auditoria**; documentação técnica extensa; gates locais de tenant/RLS documentados |
| H5 — Automação avançada | ⚠️ **parcial** | Ambiente isolado e gov-loop com maker≠checker e hash-check estão versionados, mas GitHub Actions está inativo. Permanecem `format:check` fora do gate rápido, E2E dependente de execução manual/Preview e `gov:verify` sem `test:db`/`test:e2e` |

**Por que H4 e não H5:** a instrução da auditoria é explícita — não atribuir nível só
porque os arquivos existem, avaliar se o processo está implementado. Aqui está: o gate de
isolamento multi-tenant foi desenhado para rodar em CI como check nomeado, em job paralelo, aplicando
`baseline.sql` em modo install **e** update contra um Postgres descartável. Isso é o
processo funcionando, não a intenção.

O que separa de H5 é a ausência de execução remota automática: GitHub Actions está desligado,
E2E depende de ambiente manual/Preview e `pnpm gov:verify`, o comando rápido que um agente
naturalmente usa, **não** inclui `test:db` nem `test:e2e`.

**O que puxa este projeto para cima e é incomum num CRM open-source:** doutrina escrita e
específica (`CLAUDE.md`), Definition of Done de 13 itens, **78 arquivos de invariantes de
banco**, gate de install+update do `baseline.sql` num Postgres descartável quando executado,
doutrina de QA visual com ambiente fresco estilo VPS, e uma máquina de governança de
agentes (`loop/`) com maker≠checker e hash-check.

---

## Os 20 itens

Legenda: ✅ existente e funcional · ⚠️ existente mas incompleto · ❌ não identificado · 💡 recomendado

| # | Item | Status | Evidência / lacuna |
|---|---|---|---|
| 1 | README útil | ✅ | 302 linhas: o que é, quickstart de 5 min, stack, estrutura, testes, roadmap, suporte. Traduzido (EN/ES). Mais `CHANGELOG.md` com aviso de "⚠️ Requer atenção" por versão, voltado a quem roda VPS |
| 2 | Instruções de instalação | ✅ | README §Quickstart + `docs/SETUP.md` + `docs/deploy-selfhost/` + `docs/deploy-hostgator/` + `install.sh` |
| 3 | Versão de runtime definida | ✅ | `.nvmrc` = 22, `engines.node >=22`, `packageManager: pnpm@9.15.9`, e o CI usa `setup-node@v7` com Node 22 — alinhados |
| 4 | Lockfile | ✅ | `pnpm-lock.yaml`, e ambos os jobs do CI usam `--frozen-lockfile` |
| 5 | `.env.example` | ⚠️ | Existe (+ `.env.hostgator.example`), mas **6 vars de `lib/env.ts` continuam ausentes**, entre elas 3 secrets: `IMPERSONATE_COOKIE_SECRET`, `INTERNAL_CRON_SECRET`, `LGPD_SIGNING_KEY` (+ `LGPD_DPO_EMAIL`, `LGPD_EXPORT_EXPIRES_HOURS`, `NUVEMSHOP_ENABLED`) |
| 6 | Comando de desenvolvimento | ✅ | `pnpm dev`. Nota: `docs/testing/` documenta que E2E fresco exige `build` + `start`, não `dev` |
| 7 | Comando de build | ✅ | `pnpm build`; exercitado no workflow `perf.yml` |
| 8 | Comando de lint | ✅ | `pnpm lint` (eslint), executar localmente; workflow histórico permanece versionado |
| 9 | Comando de formatação | ✅ | `pnpm format` / `format:check` (Prettier). ⚠️ `format:check` **não está no CI** |
| 10 | Checagem de tipos | ✅ | `pnpm typecheck` (`tsc --noEmit`, TS 6 estrito), executar localmente; workflow histórico permanece versionado |
| 11 | Testes unitários | ✅ | 194 arquivos `*.test.ts(x)`; executar localmente com `pnpm test:unit` |
| 12 | Testes de integração | ✅ | **78 arquivos** em `tests/invariants/` + `tests/api/`. Excluídos do `test:unit` de propósito (`vitest.config.ts:12`) e executar localmente com `pnpm test:db` |
| 13 | Testes E2E | ⚠️ | 37 specs Playwright; GitHub Actions está inativo, portanto a execução é manual/local ou via Vercel Preview conforme o runbook |
| 14 | Comando único de verificação | ⚠️ | `pnpm gov:verify` = `typecheck && lint && test:unit`. **Omite `test:db` e `test:e2e`** — verde localmente não significa verificado |
| 15 | Verificação automatizada | ⚠️ | Os workflows permanecem versionados, mas GitHub Actions está desabilitado; a prova atual é local (`typecheck`, `lint`, `test:unit`, `test:db` quando aplicável) + Preview |
| 16 | Proteção contra secrets | ⚠️ | `.gitignore` cobre `.env*` (exceção só para os `.example`) e o Sentry tem `beforeSend` que higieniza PII. **Sem** gitleaks/trufflehog no CI, **sem** pre-commit hook |
| 17 | Documentação arquitetural | ✅ | `ARCHITECTURE.md` (1 página) + `docs/specs/` (16 docs com schema e payloads) + `docs/architecture/agent-turn` + `graphify-out/` |
| 18 | Regras para agentes de IA | ✅ | `CLAUDE.md` doutrinal (convenções não-negociáveis, anti-patterns, doutrinas de migration/QA/branch), `.claude/agents/` com frota especializada, `loop/` com maker≠checker. **`AGENTS.md` criado nesta auditoria** — antes, agentes não-Claude entravam sem contexto |
| 19 | Critérios de conclusão de tarefa | ✅ | Definition of Done de 13 itens em `CLAUDE.md`; `docs/doctrine/sistema-vivo.md` com o Living System Checklist; template de PR com o checklist |
| 20 | Ambiente reproduzível | ✅ | `docker-compose.yml` (dev), `.prod.yml`, `Dockerfile` + `Dockerfile.worker`, `baseline.sql` auto-curativo, `scripts/test-db.sh` com Postgres efêmero pg17 rodando em CI. ⚠️ A receita de ambiente fresco tem armadilhas que só existem em doc (`node_modules` real e não symlink, fora de `/tmp`) — reproduzível, mas com conhecimento tácito. **Atualização 2026-08-19:** `scripts/test-db.sh` deixou de exigir Docker — detecta engine automaticamente e cai para Postgres nativo (Homebrew `postgresql@17` + `pgvector`) via `TEST_DB_ENGINE`, com os 6 arquivos que chamavam `docker exec ... psql` diretamente centralizados em `tests/invariants/pg-exec.ts` (commit `7fe2929c`). "pg17 obrigatório" na frase acima virou "Docker obrigatório" resolvido; pg17 continua sendo o requisito de versão, só que também via Homebrew local |

---

## Plano de correção, por relação custo × benefício

Ordenado por retorno. Nada aqui foi aplicado — a auditoria não altera CI, `package.json`
nem código.

### ✅ JÁ FEITO — `pnpm test:db` no CI

Era o achado principal da primeira passada desta auditoria, e estava **desatualizado**:
`origin/main` já traz o job `invariants` no `ci.yml` rodando `pnpm test:db` em paralelo ao
`verify`, com timeout de 20min e comentário explicando a escolha do job separado. Fica
registrado como corrigido, não como pendência.

### 1. Adicionar os E2E ao CI (ou a um workflow nightly) 🔴 · custo: ~30 linhas

Maior buraco restante. `vps-fresh-onboarding.spec.ts` protege a primeira impressão, que a
doutrina classifica como o caminho mais crítico do produto, e
`vps-webhook-outbound-ssrf.spec.ts` é a única prova automatizada do guard de SSRF. Rodar
em PR pode ser lento; um workflow nightly + trigger manual já elimina a regressão silenciosa.

### 2. Renomear/reforçar o comando único 🟠 · custo: 2 linhas

Duas opções: (a) `gov:verify` passa a incluir `test:db` (exige Docker em toda máquina de
dev), ou (b) mantém `gov:verify` como o loop rápido e cria `verify:full` =
`gov:verify && test:db`, com `AGENTS.md` e o DoD apontando para `verify:full` como
critério de merge. **Recomendo (b)** — preserva o loop rápido e torna a diferença explícita.

### 3. Completar `.env.example` 🟠 · custo: 6 linhas

As 6 vars ausentes, com comentário sobre quais são obrigatórias. Os 3 secrets são o caso
grave: quem instala não sabe que precisa gerá-los.

### 4. Adicionar scan de secret no CI 🟡 · custo: ~10 linhas

`gitleaks` como step. Projeto open-source com screenshots de evidência sendo commitados
tem risco real de vazamento acidental.

### 5. `format:check` no CI 🟡 · custo: 2 linhas

O script existe e não é exercitado.

---

## Não pôde ser confirmado

- Se `typecheck`/`lint`/`test:unit` **passam hoje** — o `node_modules` deste checkout está
  incompleto (70 pacotes, sem `typescript`) e a auditoria não instala dependências. Todo
  status "✅" nos itens 8, 10, 11 e 12 refere-se à *existência e configuração* do comando e
  do job de CI, **não** a uma execução verde observada.
- Taxa de sucesso histórica do CI — não consultamos a API do GitHub Actions. Sabemos que o
  job `invariants` existe; não sabemos se está passando.
- Cobertura de teste em % — configurada no Vitest (`provider: v8`), nunca coletada aqui.
- Se as branch protection rules do GitHub exigem os dois checks verdes para merge — é
  config de repositório remoto, invisível no checkout. **Isso decide se o gate de RLS é
  bloqueante ou apenas informativo**, e é a pergunta mais importante em aberto sobre o harness.

---

## Nota de método

A primeira passada desta auditoria rodou contra um checkout local **556 commits atrás** da
`origin/main`, e por isso reportou "gate de RLS fora do CI" como achado principal — quando
já estava corrigido em produção. Os números e vereditos acima foram todos recontados contra
`origin/main @ 789dfa6`. Registrado aqui porque a doutrina de higiene de branches
(`CLAUDE.md`) existe exatamente para evitar isso: **`git fetch` antes de auditar, não depois.**
