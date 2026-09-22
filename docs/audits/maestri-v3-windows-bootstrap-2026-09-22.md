# Maestri V3 — Auditoria Windows e Bootstrap

**Data:** 2026-09-22  
**Branch:** `vps`  
**Worktree:** `C:\Users\David\Desktop\Projetos\Lumenva\.worktrees\vps`  
**Escopo:** preparação local; sem merge, deploy ou alteração de `main`.

## Resultado

Auditoria concluída antes de instalar. Não foi instalado Docker, não foram repetidas instalações existentes e nenhum secret foi criado.

## Estado observado

| Área | Estado |
|---|---|
| Windows/Git/Node/Python | instalados e versionados |
| Codex CLI/auth | `0.155.1`, ChatGPT, PASS |
| Claude Code/auth | `2.1.278`, claude.ai, `claude doctor` PASS |
| Gemini CLI | `0.60.0`, instalado; MCP/extensões ausentes |
| Antigravity | `2.15.1`, instalado via winget |
| GitHub CLI/auth | `2.101.0`, autenticado; scopes observados |
| Codex MCP | configurado; servidores reportados como `Unsupported` |
| Claude MCP | Docs conectado; Railway precisa auth; GitHub falha OAuth dynamic registration |
| Jules | sem CLI oficial; SDK local presente; Action ainda não configurada |
| Agentic Workflows | extensão oficial `gh-aw v0.88.8`, doctor PASS |
| GitHub Actions | CI/M1-MCG existentes; Codex/Jules Actions ainda não configuradas |
| Documento de arquitetura | presente e lido: `docs/MAESTRI_AGENT_ARCHITECTURE.md` |

## Itens confirmados como ausentes

- Configuração Gemini MCP/extension.
- Workflows versionados Codex Action/Jules Action.

## Itens explicitamente fora deste bootstrap

- Docker: não instalar.
- kubectl/Supabase CLI: não instalar sem uso comprovado no plano V3.
- Jules CLI: não instalar; fonte oficial auditada oferece SDK/API/Action, não CLI local.
- Secrets: não criar enquanto nomes, escopo, owner e ambiente não forem definidos.

## Validação posterior à instalação

- `pnpm run maestri:v3:sdk-smoke`: PASS; imports ESM de Codex/Jules, sem chamada externa.
- `gh aw doctor`: PASS; autenticação GitHub CLI verificada.
- `gh aw version`: `v0.88.8`.
- `docker`, `docker-compose`, `kubectl`, `supabase` e `jules`: ausentes; mantidos fora do escopo conforme decisão do Owner.

## Próximo gate

SDKs locais e `gh-aw` foram instalados e validados: smoke ESM dos SDKs sem chamada externa; `gh aw doctor` PASS; versão `gh-aw v0.88.8`. O próximo gate é configurar MCP/Actions por capability e autenticação, sem criar secrets automaticamente. Nenhum workflow foi executado e nenhuma secret foi criada.

## Probing MCP — 2026-09-22

- Codex: servidores locais aparecem configurados, porém o host reporta `Unsupported`; configuração não é tratada como health.
- Claude: Docs está `Connected`; Railway precisa autenticação; GitHub falha porque o endpoint configurado não suporta dynamic client registration.
- Gemini: comando disponível, mas nenhum servidor MCP foi configurado nesta branch.
- Agentic Workflows: `gh aw mcp list` não encontrou workflows com servidores MCP.

O GitHub MCP oficial oferece caminho nativo stdio/OAuth e caminho PAT; o caminho Docker não entra nesta preparação. A documentação oficial do Codex Action exige secret do provider e a do Jules Action exige `JULES_API_KEY`; esses valores não existem no ambiente auditado e não foram inventados.
