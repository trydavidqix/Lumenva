# Maestri Agent Architecture

Status: arquitetura canônica para implantação Maestri V3; implementação incremental na branch `vps`.

## Objetivo

Definir como o Maestri coordena Claude, Codex, Jules, verificadores e ferramentas MCP sem duplicar runtime, sem despejar contexto integral e sem transformar o canvas em fonte única de estado.

## Fonte e limites

- O estado durável fica no runtime do Lumenva: tarefas, eventos, checkpoints, evidências, budgets e decisões.
- O Maestri é control plane visual e transporte; não é banco de dados nem autoridade de aprovação.
- O `docs/AGENTIC ENGINEERING OS - MASTER IMPLEMENTATION BLUEPRINT.md` é a referência operacional existente para loop, worktree, risco, verificação e human gate.
- Este documento é a referência específica de adapters, bootstrap e integração de agentes da V3.
- `main` não é alterada automaticamente; toda implementação deste ciclo ocorre na branch `vps`.

## Topologia

```text
OWNER / HUMAN GATE
        │
        ▼
MAESTRI CONTROL PLANE
        │ TaskContract + ContextPacket + capability grants
        ▼
MAESTRI RUNTIME
  Job Engine · Context Engine · Budget Engine · Policy Engine
        │
        ├── Claude Maestro  (manager / orchestration)
        ├── Codex            (builder / execution)
        ├── Jules            (optional external execution)
        ├── Verifier         (deterministic checks)
        └── Reviewer         (fresh, read-only, independent)
        │
        ▼
MCP Gateway + ExecutionPorts + Evidence/Trace Store
```

## Contratos canônicos

`TaskContract` é o único contrato de entrada:

```text
task_id, goal, scope, allowed_paths, constraints,
capabilities, risk, base_sha, context_budget, tool_budget,
execution_budget, preferred_provider, evidence_required
```

`ContextPacket` contém somente o necessário para a etapa atual:

```text
objective, relevant_instructions, relevant_files, relevant_symbols,
prior_decisions, constraints, available_tools, evidence, token_budget
```

`ExecutionResult` uniformiza adapters:

```text
task_id, status, summary, files_changed, commands, tests,
evidence, usage, context_used, error
```

O próximo agente recebe `ResultDigest`, não a sessão ou logs completos. Logs ficam no evidence store com hash e referência recuperável.

## Regras de contexto e ferramentas

1. Resolver contrato, instruções, código, memória e ferramentas antes da execução.
2. Começar com contexto mínimo e expandir sob demanda por pedido explícito.
3. Expor tools por capability e tarefa; nunca enviar o catálogo global por padrão.
4. Aplicar hard caps de tokens, bytes, arquivos, chamadas e tempo.
5. Registrar `context_packet_id`, ferramentas expostas/chamadas e evidência.

## Adapters e MCP

- `ExecutionPort` abstrai `execute`, `resume`, `cancel`, `health`, `capabilities`, `usage` e `quota`.
- Claude, Codex e Jules são providers substituíveis; nenhum conhece a lógica completa do Maestri.
- Cross-agent ocorre por `HandoffRequest` → Maestri → novo `ContextPacket`.
- MCP é gateway stateless/cacheável quando suportado pelo servidor; catálogos têm ordenação determinística e TTL explícito.
- Capability probing e health checks são obrigatórios; configuração presente não significa tool utilizável.
- O escopo inicial é read-only. Escrita externa, secrets, produção, merge e deploy exigem policy e Human Gate.

## Bootstrap Windows V3

O bootstrap documentado em `docs/audits/maestri-v3-windows-bootstrap-2026-09-22.md` entra antes das fases de adapter e gateway:

1. Auditar instalações, versões, PATH, autenticação, MCP, CLI, SDK, plugin, skill, hook e Actions.
2. Reutilizar instalação saudável; instalar somente dependência comprovadamente ausente.
3. Não instalar Docker nesta fase. Sandbox/container continua uma capacidade condicionada ao risco, não pré-requisito do bootstrap.
4. Manter secrets fora do Git; Actions recebem apenas referências a secrets previamente criados pelo Owner.
5. Validar cada instalação e registrar comando, versão, health e limitação.

Estado inicial da V3:

- Codex CLI, Claude Code, Gemini CLI, GitHub CLI e ferramentas locais principais estão instalados.
- `@openai/codex-sdk`, `@google/jules-sdk` e `gh-aw` foram adicionados após confirmação de ausência.
- `docs/MAESTRI_AGENT_ARCHITECTURE.md` passa a ser este contrato canônico.
- GitHub MCP, Gemini MCP, Actions Codex/Jules e secrets continuam gates separados de configuração e autenticação.

## Observabilidade

Cada execução deve correlacionar `trace_id`, `job_id`, `task_id`, `agent_id`, `execution_id` e `context_packet_id`, além de tokens de entrada/cache/saída, bytes de contexto, tools, arquivos lidos, duração, custo, provider, retries, policy e terminal status.

## Gates de aceite

- nenhuma ferramenta global desnecessária;
- nenhum contexto sem hard cap;
- ContextPacket reproduzível;
- expansão de contexto sob demanda;
- provider substituível sem alterar `TaskContract`;
- Claude ↔ Codex via Maestri e digest;
- fallback, quota, usage e resume reais;
- evidência persistida e trace atravessando MCP;
- nenhuma dependência dos stubs antigos;
- benchmark baseline versus Context Fabric sem regressão de sucesso.

## Fontes oficiais

- Codex CLI/SDK/Action: https://github.com/openai/codex · https://github.com/openai/codex/blob/main/sdk/typescript/README.md · https://github.com/openai/codex-action
- Claude Code: https://docs.anthropic.com/en/docs/claude-code/getting-started · https://docs.anthropic.com/en/docs/claude-code/cli-usage
- Gemini CLI: https://github.com/google-gemini/gemini-cli
- Jules API/SDK/Action: https://developers.google.com/jules/api · https://github.com/google-labs-code/jules-sdk · https://github.com/google-labs-code/jules-action
- GitHub MCP/Agentic Workflows/Secrets: https://github.com/github/github-mcp-server · https://github.github.com/gh-aw/ · https://docs.github.com/en/actions/concepts/security/secrets
