# Maestri V3 Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** preparar a branch `vps` para o Maestri V3 com ferramentas oficiais, contratos documentados e validação sem alterar `main` ou instalar Docker.

**Architecture:** reutilizar o Agent OS/Command Center existente. O Maestri coordena contratos, contexto, budgets, adapters e evidências; Claude, Codex e Jules entram como providers atrás de `ExecutionPort`.

**Tech Stack:** Windows, PowerShell, Git worktree, pnpm, Codex CLI/SDK, Claude Code, Gemini CLI, Jules SDK, GitHub CLI, `gh-aw`, GitHub Actions e MCP.

**Spec:** `docs/MAESTRI_AGENT_ARCHITECTURE.md`, `docs/LUMENVA_COMMAND_CENTER_PLAN.md` e `docs/AGENTIC ENGINEERING OS - MASTER IMPLEMENTATION BLUEPRINT.md`.

## Global Constraints

- Trabalhar somente na branch `vps`.
- Não fazer merge, push protegido ou alteração em `main`.
- Auditar antes de instalar; não duplicar instalações saudáveis.
- Não instalar Docker nesta fase.
- Usar fontes oficiais e não versionar secrets.
- Cada mutação deve ter validação reproduzível.

## Review Focus

- Instalação já existente deve ser reutilizada, não substituída.
- SDK ausente deve entrar no workspace correto e aparecer no lockfile.
- Actions não podem executar sem secrets/permissões explicitamente definidos.
- MCP configurado não pode ser tratado como tool saudável sem probing.
- Documento ausente não pode ser alegado como previamente lido.

### Task 1: Auditoria e baseline

**Files:** `docs/audits/maestri-v3-windows-bootstrap-2026-09-22.md`

- [x] Auditar Windows, CLIs, SDKs, auth, MCP, plugins, skills, hooks e Actions.
- [x] Confirmar branch/worktree e ausência de agentes concorrentes na mesma task.
- [x] Registrar gaps, fontes oficiais e itens fora do escopo.

### Task 2: Plano e arquitetura canônica

**Files:** `docs/LUMENVA_COMMAND_CENTER_PLAN.md`, `docs/MAESTRI_AGENT_ARCHITECTURE.md`

- [x] Inserir bootstrap no plano único do Command Center.
- [x] Criar a arquitetura canônica porque o caminho solicitado não existia.
- [x] Definir contratos, progressive context, MCP gateway, adapters, observabilidade e gates.

### Task 3: SDKs oficiais locais

**Files:** `package.json`, `pnpm-lock.yaml`

- [x] Confirmar ausência de `@openai/codex-sdk` e `@google/jules-sdk`.
- [x] Adicionar `@openai/codex-sdk@0.155.1` e `@google/jules-sdk@0.2.0` como devDependencies raiz.
- [x] Importar cada SDK em smoke test sem chamar API externa.

### Task 4: GitHub Agentic Workflows

**Files:** configuração da extensão GitHub CLI; futuros `.github/workflows/*.md`

- [x] Confirmar `gh-aw` ausente.
- [x] Instalar a extensão oficial `github/gh-aw`.
- [x] Executar `gh aw doctor` e registrar versão/health.
- [ ] Só depois criar workflow `.md` revisado com permissões mínimas.

### Task 5: MCP e autenticação por capability

**Files:** configuração local dos hosts; documentação de integração

- [ ] Probar os servidores MCP existentes e separar `configured` de `healthy`.
- [ ] Resolver GitHub MCP por OAuth/token oficial sem Docker e sem expor token.
- [ ] Configurar Gemini MCP somente com credencial/escopo definidos pelo Owner.
- [ ] Manter read-only inicial e registrar limitações.

### Task 6: Actions, secrets e integração

**Files:** `.github/workflows/`, documentação de secrets

- [ ] Adicionar Codex Action e Jules Action somente com secrets nomeados e permissões mínimas.
- [ ] Não criar secrets automaticamente; registrar nomes, owners e ambientes necessários.
- [ ] Validar YAML, compilação gh-aw, permissões e dry-run em `vps`.

### Task 7: Prova e fechamento

**Files:** auditoria, plano, relatórios de validação

- [ ] Rodar smoke tests dos SDKs, CLIs e adapters.
- [ ] Rodar gates de docs, lockfile, secret scan e `git diff --check`.
- [ ] Registrar branch, commits, evidências e pendências; não fazer merge em `main`.
