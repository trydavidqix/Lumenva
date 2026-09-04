# Auditoria e2e de código morto, lixo e duplicação — 2026-09-03

Escopo: repositório inteiro em `main`, `HEAD 03c29e7012acd842543d295a74b04ad732c15404`, 3.443 arquivos rastreados. Auditoria somente leitura; nenhum arquivo de código foi editado, removido ou commitado. O worktree já estava sujo antes da auditoria (alterações e artefatos locais preexistentes); eles foram preservados.

## Método e limitações

Comandos executados:

```text
pwd
git status --short
git branch --show-current
git rev-parse HEAD
git ls-files | wc -l
find app lib components hooks workers website/app website/components website/hooks website/lib tests scripts -type f ...
git ls-files -z | git check-ignore --stdin -z --no-index
git ls-files | rg '(^|/)(\.next|node_modules|coverage|dist|build|tmp|temp|cache|e2e-artifacts|test-results|.*\\.(log|db|sqlite|pid|seed|bak|orig|swp)$)'
```

`ts-prune`, `depcheck` e `knip` não existem em `node_modules/.bin`. Foi tentado `npx --no-install`; o processo não forneceu resultado utilizável e não foi autorizado nenhum download/instalação. Portanto, resultados de exports/dependências abaixo são triagem manual, não substituem esses analisadores.

Exceção: o subprojeto `website/` já possui `knip@6.34.0` instalado. Foram executados `./node_modules/.bin/knip --reporter compact --no-progress --no-exit-code` e o modo combinado `--dependencies --files --exports`; ambos retornaram exit code 0, sem arquivos órfãos ou dependências não usadas.

## Dead exports

### Candidato forte: módulo legado idêntico e sem consumidores

- `lib/agent-engine/agent/skills-legacy.ts:1` — arquivo inteiro é byte-a-byte idêntico a `lib/agent-engine/agent/skills.ts` (336 linhas; `cmp -s` retornou 0; `shasum` igual `36f495b...`).
- Evidência de referências: `git grep -n 'skills-legacy' -- ':!docs/**'` não encontrou consumidor. Os imports de runtime/teste apontam para `./skills` e `../../agent-engine/agent/skills` (`lib/agent-engine/agent/inbound-turn.ts:104`, `lib/agent-engine/agent/skills.test.ts:2`, `lib/ai/skills/install.ts:15`, `lib/ai/skills/package.ts:9`).
- Confiança de que é export/arquivo morto: **alta**. Segurança de remoção: não decidida nesta auditoria; confirmar histórico/intenções antes de apagar.

Não foram encontrados outros exports com evidência suficiente para classificar como mortos sem um analisador AST. Declarations exportadas usadas apenas por rotas dinâmicas, barrels, testes ou reflection podem gerar falsos positivos na busca textual.

No `website/`, Knip sinalizou 3 exports não importados externamente e 8 tipos exportados não importados externamente: `website/components/ui/BrandIcons.tsx:179,197` (`FacebookIcon`, `InstagramIcon`), `website/content/home.ts:211` (`approvedResults`) e `website/lib/contact-form.ts:3` (`contactRequestSchema`); tipos em `Footer.tsx:14`, `Header.tsx:13`, `SidebarNav.tsx:5`, `ServiceHero.tsx:6,10`, `FeatureCardGrid.tsx:4,6`, `GoogleAppIcons.tsx:3`, `content/home.ts:74,205` e `content/legal.ts:1`. São achados de visibilidade do módulo, não prova de código morto: os ícones aparecem no mapa local `brandIcons:217-218`, o schema é usado internamente e tipos podem servir a consumidores externos/contratos. Confiança baixa para remoção.

## Dependências potencialmente não usadas

Busca textual agregada sobre `app/`, `lib/`, `components/`, `hooks/`, `workers/`, `website/`, `tests/` e `scripts/` não encontrou imports diretos para:

- `@langchain/core` — somente manifesto `package.json:56`; revisar transitividade via `@langchain/langgraph` antes de qualquer alteração.
- `@tanstack/react-virtual` — manifesto `package.json:80` e menções apenas em documentação (`docs/specs/04...:2145-2146`, `docs/stories/epics/EPIC-03...:896`); não há import localizado.
- `import-in-the-middle` — manifesto `package.json:89`; sem import localizado.
- `require-in-the-middle` — manifesto `package.json:105`; sem import localizado.

Esses quatro são **candidatos**, confiança baixa/média: bundlers, instrumentação, dependências transitivas e imports gerados podem não aparecer na busca. Outros pacotes inicialmente suspeitos foram confirmados: `@emoji-mart/data`/`@emoji-mart/react` em `components/inbox/composer/EmojiButton.tsx:10,47`; `pdf-parse` em `lib/ai/rag/extractors/pdf.ts:26` e testes; tipos/configuração possuem usos legítimos.

## Arquivos órfãos — docs e scripts

### Documentação duplicada ou potencialmente redundante

- Mesmo título `# Auditoria Fase 4 — Gateway e Dependabot` em `docs/audits/phase-4-gateway-dependabot-audit-2026-09-01.md` e `docs/audits/phase4-gateway-dependabot-audit-2026-09-01.md`. Comparar conteúdo/SHA e manter apenas a fonte histórica necessária; confiança média.
- A versão sem hífen é citada por `docs/audits/branch-consolidation-FINAL-2026-09-01.md:11`; os dois relatórios têm 89 e 66 linhas, sobreposição substancial e a mesma fotografia SHA. Confiança alta de reconciliação necessária, sem autorização para remover.
- Mesmo título `# Agent OS Low-Deploy Verification Implementation Plan` em `docs/superpowers/plans/2026-08-17-agent-os-low-deploy-verification-implementation-plan.md` e `docs/superpowers/plans/2026-08-17-agent-os-low-deploy-verification-plan.md`; provável duplicação de plano, confiança média.
- `docs/audits/upstream-branches-review-2026-09-02.md` e `docs/audits/upstream-branches-review-2026-09-02-v2.md` são versões concorrentes: o v2 revisa a fotografia e a classificação, mas `docs/handoffs/HANDOFF-2026-09-02-agent-os-completo.md:94` ainda aponta para a versão antiga. Confiança alta de referência supersedida a reconciliar.
- Dez cópias do relatório `# last30days v3.19.0: dental clinics Lisbon WhatsApp customer service` em execuções de pesquisa de 2026-09-02/03 sob `docs/pesquisa/.../last30days/`. Parecem snapshots por execução, não código morto; tratar como artefatos de pesquisa e verificar retenção/deduplicação.
- `docs/archive/vendaval-fusion-plan.md` e `docs/archive/vendaval-vps-deploy-comandos.md` são explicitamente históricos: `docs/index.md` registra que Vendaval já foi absorvido em `main`; não classificar como lixo sem política de retenção.

### Scripts sem chamada evidente

O manifesto raiz referencia explicitamente apenas um subconjunto dos scripts (`e2e-build.sh`, `gerar-env-e2e.sh`, `run-test-db.mjs`, `lint-*.ts`, avaliações, benchmarks, etc.). Busca por basename não encontrou referência externa para 24 scripts, incluindo `inspect-source-schema.ts`, `dbg-login.ts`, `check-user.ts`, `check-roles.ts`, `create-test-user.ts`, `reset-user-onboarding.ts`, `revoke-sessions.ts`, `probe-redirect.ts`, `observar-escalacao-turno-real.ts`, `prova-modelo-escolhe-retorno.ts`, `screenshot-ai-tabs.ts`, `seed-risk-states.ts`, `spike-adapter-meta.ts`, `spike-sync-templates.ts`, `spike-send-template-real.ts` e `qa-wave-08.ts`–`qa-wave-13-09.ts`. Cabeçalhos indicam que muitos são instrumentos manuais/one-shot ou QA histórico. `scripts/README.md:5-7` cataloga apenas `seed-tenant.ts`, que o próprio arquivo descreve como placeholder planejado. Confiança média para “não integrado”, baixa para remoção segura.

## Temporários/lixo commitado

`git ls-files -z | git check-ignore --stdin -z --no-index` encontrou nove arquivos rastreados que ainda casam regras de `.gitignore`:

- `.claude/ecc-tools.json`, `.claude/identity.json`, `.claude/homunculus/instincts/inherited/DeskcommCRM-instincts.yaml`;
- `.claude/skills/DeskcommCRM/SKILL.md`;
- quatro relatórios em `.superpowers/sdd/.../task-5-report.md` e `task-6-report.md`;
- `website/.env.example`.

Os metadados `.claude/*` e relatórios `.superpowers/sdd/*` parecem gerados/históricos (confiança média; `identity.json` é o candidato mais forte). `.claude/skills/DeskcommCRM/SKILL.md` é explicitamente ponte versionada citada por `AGENTS.md`, portanto não é lixo comprovado. `website/.env.example` é template legítimo, mas há inconsistência: `.gitignore` raiz permite templates de exemplo, enquanto `website/.gitignore:11` ignora qualquer `.env*`.

Não foram encontrados arquivos rastreados em `node_modules`, `.next`, `dist`, `build`, `coverage`, `test-results`, `playwright-report`, `__pycache__`, `.DS_Store`, logs, bancos SQLite/DB ou dumps. Os bancos `.last30days-library.db` observados no `git status` estão não rastreados e em diretórios de pesquisa; não foram incluídos no Git.

## Duplicação de código

1. `lib/agent-engine/agent/skills-legacy.ts` e `lib/agent-engine/agent/skills.ts`: duplicação exata, 336/336 linhas, hash idêntico; sem referências ao sufixo `-legacy`.
2. Helpers de autenticação interna repetidos em cinco rotas: `timingSafeEq` em `app/api/internal/voice/{event,turn,context,worker-config}/route.ts` e `app/api/internal/agents/run/route.ts` (linhas 23–45/126–145); `authorize` repete leitura de `env.INTERNAL_SECRET` e `x-internal-secret` em quatro rotas. Há diferença funcional no suporte a Bearer de `agents/run`, portanto é duplicação de boundary com risco alto de drift, não prova de equivalência.
3. `startOfUtcDay`, `endOfUtcDay`, `parseDayUtc` e `resolveRange` repetidos em `app/api/v1/ai/evolution/route.ts:38-62` e `app/api/v1/ai/usage/route.ts:34-54`; risco de janelas UTC divergirem.
4. `formatDate` repetido em `components/admin/tenants/TenantOverview.tsx:14-23`, `TenantsTable.tsx:58-65`, `HealthGrid.tsx:16-25`, `app/app/ai/skills/_client.tsx:23-31` e `app/app/ai/memory/_client.tsx:36-44`; há divergência de ano de dois/quatro dígitos.
5. Formatação monetária repetida em `components/kanban/StageColumn.tsx:30-40`, `LeadDossier.tsx:22-33` e `KanbanCard.tsx:32-44`, com fallbacks BRL/moeda diferentes.
6. `escapeHtml` repetido em `lib/email/templates/ai-budget-alarm.tsx:77-84`, `lib/email/templates/invite.ts:61-68` e `app/api/oauth/authorize/route.ts:9`; risco de correções de escaping não propagarem.
7. `asObject` repetido em `lib/ai/apply-proposal.ts:29-33`, `app/api/v1/ai/evolution/route.ts:58-62` e `lib/agent-engine/flywheel/store.ts:34-38`; `base64url` tem implementações relacionadas em `lib/nuvemshop/state.ts:26-32` e `lib/impersonate/cookie.ts:50-62`.
8. Formatação de datas de gráfico em `components/ai/UsageChart.tsx:23-30` e `components/admin/usage/UsageCharts.tsx:17-20` diverge em UTC versus timezone local, podendo deslocar o dia.
9. Não foi confirmada outra duplicação byte-a-byte na busca de hashes entre `app/`, `lib/`, `components/`, `hooks/`, `workers/`, `website/`, `scripts/` e `tests`. Similaridade semântica adicional exigiria AST/clone detector; `jscpd` não estava instalado e não foi baixado.

## Achados arriscados que valem investigação

- A divergência de `.gitignore` para `website/.env.example` pode esconder um template necessário ou permitir que uma futura mudança de configuração desapareça do diff.
- Arquivos rastreados sob `.claude/` e `.superpowers/` podem conter metadata local, identidade ou relatórios de processo; revisar exposição/necessidade de versionamento antes de alterar padrões.
- Dependências sem import aparente (`@langchain/core`, `@tanstack/react-virtual`, `import-in-the-middle`, `require-in-the-middle`) não devem ser removidas sem `pnpm why`, inspeção de bundler e execução dos gates.
- Os dez snapshots `last30days` e os scripts de spike/QA podem ser evidência operacional deliberada; remoção cega perderia reprodutibilidade.

## Contagem resumida

- Dead exports/arquivos de código: **1 candidato forte** (`skills-legacy.ts`) + **3 exports e 8 tipos sinalizados por Knip no website**, todos requerendo revisão por possíveis usos internos.
- Dependências potencialmente não usadas: **4 candidatos** (baixa/média confiança).
- Docs potencialmente duplicados/órfãos: **3 pares/linhas de versões concorrentes + 10 snapshots de pesquisa**; arquivos históricos explicitamente preservados.
- Scripts sem chamada automática detectada: **24 candidatos** sem referência externa; não confirmados como lixo.
- Temporários/configuração rastreados casando `.gitignore`: **9 arquivos**, com 1 template legítimo e uma ponte de skill explicitamente versionada.
- Duplicação de código confirmada: **1 par exato**.
