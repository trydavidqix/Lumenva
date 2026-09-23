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
- [x] Criar workflows manuais YAML revisados com permissões mínimas e guard `vps`; Agentic Workflow Markdown permanece fora do escopo deste repositório.

### Task 5: MCP e autenticação por capability

**Files:** configuração local dos hosts; documentação de integração

- [x] Probar os servidores MCP existentes e separar `configured` de `healthy`.
- [x] Resolver GitHub MCP com o binário oficial em modo read-only/lockdown, sem Docker e sem expor token; Claude confirmou `Connected`.
- [x] Configurar Gemini MCP no escopo do projeto usando o binário GitHub oficial em read-only/lockdown e sem token persistido; o host permanece desabilitado até o workspace ser confiado.
- [x] Manter read-only inicial e registrar limitações.

### Task 6: Actions, secrets e integração

**Files:** `.github/workflows/`, documentação de secrets

- [x] Adicionar Codex Action e Jules Action somente com secrets nomeados e permissões mínimas; ambos são manuais e restritos a `vps`.
- [x] Não criar secrets automaticamente; registrar nomes, owners e ambientes necessários. `JULES_API_KEY` foi configurada depois por autorização explícita do Owner.
- [x] Validar YAML, permissões e guard estático em `vps`; `gh aw validate` não se aplica porque não existem workflows Markdown Agentic.

### Task 7: Prova e fechamento

**Files:** auditoria, plano, relatórios de validação

- [x] Rodar smoke tests dos SDKs, CLIs e adapters.
- [x] Rodar gates de docs, lockfile, secret scan e `git diff --check`.
- [x] Registrar branch, commits, evidências e pendências; não fazer merge em `main`.

### Task 8: Normalização global pós-bootstrap

**Files:** `%USERPROFILE%\.claude.json`, `%USERPROFILE%\.codex\config.toml`, `%USERPROFILE%\.claude\skills\`, `%USERPROFILE%\.agents\skills\`, `%USERPROFILE%\.lumenva\bin\`; configurações MCP globais de Claude/Codex; `.codex/config.toml` e `.gemini/settings.json` no worktree `vps`.

- [x] Reutilizar `gh` e `gh-aw v0.88.8` globais; confirmar Codex CLI, Claude Code, Jules CLI e Google Cloud SDK presentes antes de instalar.
- [x] Instalar globalmente `@google/jules@0.1.42`, autenticar por `jules login` e validar leitura dos repositórios conectados via `jules remote list --repo`.
- [x] Instalar globalmente `@openai/codex-sdk@0.156.0` e `@google/jules-sdk@0.2.0`, sem mudar `package.json`/lockfile do projeto.
- [x] Instalar GitHub MCP Server oficial `v1.12.2` globalmente, validar checksum SHA-256 oficial e configurar toolsets read-only/lockdown.
- [x] Registrar GitHub MCP e Jules MCP no escopo global do Claude e do Codex; manter as credenciais fora dos arquivos usando GitHub CLI e Google Secret Manager em runtime.
- [x] Instalar globalmente as duas Jules Skills e a skill `agentic-workflows`; não instalar `act` nem Docker.
- [x] Remover somente os registros GitHub MCP dos arquivos de projeto `.codex/config.toml` e `.gemini/settings.json` no worktree `vps`, preservando os outros servidores e configurações.
- [x] Não copiar GitHub Actions, Claude Code Action, Codex Action ou Jules Action para um diretório global: são usados por workflows de repositórios. Preservar os workflows versionados já existentes em `vps`.
- [ ] Depois de reiniciar o Codex, validar uma chamada GitHub MCP somente leitura e uma consulta de sessões Jules sem criar sessão nem alterar estado externo.
- [ ] Rever os avisos do instalador das skills antes de qualquer uso: `local-action-verification` pressupõe Docker/`act` e é alto risco; `automate-github-issues` pode despachar agentes e mesclar PRs.
