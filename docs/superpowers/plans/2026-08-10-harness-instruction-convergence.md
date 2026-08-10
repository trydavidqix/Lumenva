# Harness Instruction Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convergir Claude Code, Codex e demais agentes do DeskcommCRM para uma única doutrina, modularizar regras e impedir regressões de instruções antigas.

**Architecture:** `CLAUDE.md` permanece autoridade. `.claude/rules/` contém regras por domínio. Skills e agents apontam para a doutrina em vez de manter cópias congeladas. Um gate determinístico valida consistência e roda no CI.

**Tech Stack:** Markdown, Node.js 22, pnpm, GitHub Actions.

## Global Constraints

- Trabalhar somente na branch `gpt-harness-convergence`.
- Não alterar `main`.
- Não tocar em Supabase, Vercel, WAHA, Redis, Docker, dados reais ou segredos.
- Não versionar `.claude/settings.json`.
- Preservar `gov-loop`, `triagem-*` e `.codex/agents/` em comportamento.
- Não criar dependência nova.
- Não alterar a arquitetura de IA planejada em `gpt-ai-platform`.

---

### Task 1: Corrigir a política de versionamento de `.claude/`

**Files:**
- Modify: `.gitignore`

**Produces:** `.claude/rules/` versionável, mantendo o restante local salvo exceções já existentes.

- [ ] Adicionar exceção explícita para `.claude/rules/`.
- [ ] Manter `.claude/settings.json` ignorado.
- [ ] Não ampliar o versionamento para todo `.claude/`.
- [ ] Revisar o diff da seção `.claude/`.

### Task 2: Criar rules compartilhadas por domínio

**Files:**
- Create: `.claude/rules/git-workflow.md`
- Create: `.claude/rules/security.md`
- Create: `.claude/rules/multi-tenancy.md`
- Create: `.claude/rules/database-migrations.md`
- Create: `.claude/rules/testing-verification.md`
- Create: `.claude/rules/documentation.md`
- Create: `.claude/rules/graphify.md`
- Create: `.claude/rules/skill-routing.md`

**Produces:** módulos de doutrina reutilizáveis e focados.

- [ ] Extrair apenas regras já existentes/confirmadas no repo.
- [ ] Cada rule declara que `CLAUDE.md` vence em caso de conflito.
- [ ] Evitar duplicar documentação extensa de produto.
- [ ] Não criar regra nova de negócio.

### Task 3: Sincronizar skill Claude e skill Codex

**Files:**
- Modify: `.claude/skills/DeskcommCRM/SKILL.md`
- Modify: `.agents/skills/DeskcommCRM/SKILL.md`
- Preserve: `.agents/skills/DeskcommCRM/agents/openai.yaml`

**Produces:** duas superfícies com a mesma doutrina e sem convenções históricas falsas.

- [ ] Usar `CLAUDE.md` como fonte principal nas duas skills.
- [ ] Remover `snake_case` normativo para arquivos.
- [ ] Remover imports relativos como regra do projeto.
- [ ] Remover `/fix-bug` e `/add-module`.
- [ ] Manter skill pequena e orientada a carregamento da doutrina/rules.

### Task 4: Neutralizar artefatos ECC/homunculus antigos

**Files:**
- Modify: `.claude/homunculus/instincts/inherited/DeskcommCRM-instincts.yaml`
- Modify: `.claude/ecc-tools.json`

**Produces:** artefatos compatíveis que não contradizem a doutrina atual.

- [ ] Remover instruções históricas normativas de naming/import.
- [ ] Deixar explícito que artefato gerado não substitui `CLAUDE.md`.
- [ ] Atualizar referência do repositório para `trydavidqix/CRM` onde for metadata ativa.
- [ ] Não inventar timestamp de geração; diferenciar metadata histórica de manutenção manual.

### Task 5: Modularizar `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Produces:** entrada focada, com regras transversais e links para rules.

- [ ] Preservar autoridade, visão, stack, invariantes críticas, paths, comandos, safety gates e DoD.
- [ ] Padronizar comandos canônicos em `pnpm`.
- [ ] Mover detalhes extensos de Git, security, tenancy, migrations, testes, docs, Graphify e skills para rules.
- [ ] Manter deploy apontando para runbook em vez de copiar manual inteiro.
- [ ] Não remover regra sem correspondente explícito em rule/doc canônico.

### Task 6: Sincronizar `AGENTS.md` e `.codex/AGENTS.md`

**Files:**
- Modify: `AGENTS.md`
- Modify: `.codex/AGENTS.md`

**Produces:** contrato portátil alinhado e sem números/estado congelados usados como doutrina.

- [ ] `AGENTS.md` aponta para `CLAUDE.md` e rules.
- [ ] Remover/qualificar informações temporais que possam envelhecer como regra.
- [ ] `.codex/AGENTS.md` deixa claro que `.agents/skills/DeskcommCRM/SKILL.md` é ponte e não autoridade.
- [ ] Preservar separação de credenciais locais.

### Task 7: Criar gate de consistência do harness com TDD

**Files:**
- Create: `scripts/check-harness-consistency.mjs`
- Create: `scripts/check-harness-consistency.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: comando `pnpm harness:check` com exit code 0/1.

- [ ] Escrever testes que representem as regressões conhecidas.
- [ ] O gate deve inspecionar arquivos de harness versionados sem ler `.env`.
- [ ] Falhar para `/fix-bug`, `/add-module`, repo histórico ativo, regra normativa `snake_case` de arquivos e regra normativa de imports relativos.
- [ ] Exigir referência a `CLAUDE.md` nas duas skills DeskcommCRM.
- [ ] Confirmar que `.claude/rules/` está presente e permitido pelo `.gitignore`.
- [ ] Adicionar `harness:check` a `package.json`.
- [ ] Adicionar step `Harness consistency` ao job `verify` do CI antes dos unit tests.

### Task 8: Atualizar documentação do harness

**Files:**
- Modify: `docs/harness-audit.md` quando necessário
- Modify: `docs/index.md` apenas para apontar para a nova estrutura, sem recalcular números que não foram medidos
- Create: `docs/runbooks/agent-harness.md`

**Produces:** explicação humana da hierarquia e manutenção do harness.

- [ ] Documentar `CLAUDE.md → rules → skills/agents → gates`.
- [ ] Documentar que `settings.json` é local.
- [ ] Documentar como sincronizar Claude/Codex sem duplicar doutrina.
- [ ] Documentar o comando `pnpm harness:check`.

### Task 9: Revisão estática final da branch

**Files:** todos os arquivos alterados nesta iniciativa.

- [ ] Comparar `main...gpt-harness-convergence`.
- [ ] Confirmar que não há schema, app, lib, worker, infra ou segredo alterado fora do escopo.
- [ ] Procurar `/fix-bug`, `/add-module`, `melgarafael/DeskcommCRM`, naming `snake_case` normativo e imports relativos normativos nos artefatos ativos.
- [ ] Confirmar que `.claude/settings.json` continua não versionado.
- [ ] Confirmar que `gov-loop`, `triagem-*` e `.codex/agents/*.toml` não tiveram comportamento alterado.
- [ ] Registrar explicitamente quais testes não puderam ser executados sem ambiente local/CI da branch.

## Self-review

- Cobertura da spec: todas as decisões da spec têm task correspondente.
- Sem placeholders: não há `TBD`, `TODO` ou ação vaga necessária para execução.
- Escopo: limitado ao harness/instruções e gate determinístico.
- Dependências: nenhuma nova dependência externa.
