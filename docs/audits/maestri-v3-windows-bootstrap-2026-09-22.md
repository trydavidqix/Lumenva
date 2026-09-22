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
- GitHub MCP: o registro do worktree foi corrigido para o binário oficial `github-mcp-server stdio --read-only --lockdown-mode`; o host Codex ainda reporta auth `Unsupported`, enquanto Claude confirma `Connected`.
- Claude: Docs está `Connected`; Railway precisa autenticação; GitHub falha porque o endpoint configurado não suporta dynamic client registration.
- Gemini: GitHub MCP oficial configurado no escopo do projeto, read-only/lockdown. O Owner autorizou `--skip-trust`; o trust local passou.
- O OAuth Google concluiu no navegador, mas o CLI recusou o fluxo individual com a mensagem de cliente não suportado para Gemini Code Assist. O fallback Vertex AI usando o projeto `lumenva` também retornou `403 (#3501)`, licença válida ausente. Não foi criada API key nem instalado Antigravity.
- Os workflows Maestri V3 foram publicados somente em `vps` (`e7f39825`); `actionlint` passa localmente e a API de conteúdo confirma os dois arquivos na branch. O GitHub não os registra em `actions/workflows` nem aceita `workflow_dispatch` porque os arquivos ainda não estão na branch padrão; o dispatch Jules retornou `404`. Não houve merge para `main`.
- Jules SDK oficial foi validado diretamente contra `trydavidqix/Lumenva@vps` na sessão `15571346256263829722`; a auditoria foi read-only, sem commit/PR, confirmou Graphiti/OTLP em fallback seguro, 8 testes Knowledge Graph, 44 testes Core, 37 testes MCG e `READY_FOR_VPS`. Isto valida o provider Jules, mas não substitui a execução do GitHub Action, que permanece impedida pela regra da branch padrão.
- Agentic Workflows: `gh aw mcp list` não encontrou workflows com servidores MCP.

O GitHub MCP oficial oferece caminho nativo stdio/OAuth e caminho PAT; o caminho Docker não entra nesta preparação. A documentação oficial do Codex Action exige secret do provider e a do Jules Action exige `JULES_API_KEY`; esses valores não existem no ambiente auditado e não foram inventados.

Foram adicionados `.github/workflows/maestri-v3-codex-manual.yml` e `.github/workflows/maestri-v3-jules-manual.yml`: ambos são `workflow_dispatch`, aceitam somente a branch `vps` e têm `contents: read`. A validação estática passou; não foram disparados por falta dos secrets externos.

O `actionlint v1.7.12` oficial foi instalado após confirmar ausência. A primeira validação encontrou um input incompatível no Codex Action; foi corrigido para `safety-strategy: read-only`, e a validação final dos dois YAMLs passou.

Consulta read-only ao repositório remoto `trydavidqix/Lumenva` não encontrou secrets de Actions. Os workflows novos e os commits da preparação permanecem apenas no worktree local; nenhum push ou merge foi executado.

Após autorização explícita, `JULES_API_KEY` foi copiada do Google Secret Manager (`project=lumenva`, versão `latest`) para o secret de Actions homônimo. O valor não foi exibido, salvo ou versionado. O workflow Jules continua manual e não foi executado.

O Graphiti standalone foi fechado em modo seguro local: `GRAPHITI_MODE` ausente significa `off`; configuração incompleta não cria cliente HTTP; o Core responde `/graph` com resultado read-only vazio. Nenhum endpoint remoto é chamado nesta configuração.
