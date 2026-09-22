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


# Maestri V3 — Mega Blueprint Consolidado

Este capítulo consolida a arquitetura alvo completa para Claude CEO + Maestri + Codex CTO + Codex Cloud + Jules/Gemini 3.1 Pro + GitHub, sem substituir os gates externos já documentados.

## Princípio operacional

Planejar centralmente. Executar distribuído. Validar objetivamente. Registrar tudo.

```text
VOCÊ
  ↓
CLAUDE CODE — CEO
  ↓
MAESTRI
  ├── Master Planner
  ├── Dependency Graph
  ├── Work Package Compiler
  ├── Conflict Graph
  ├── Prompt Compiler
  ├── Policy Engine
  ├── Hook Engine
  ├── Scheduler / Queue
  ├── Quota + Resource Managers
  ├── Failure Classifier
  ├── Escalation Engine
  ├── Evidence Validator
  ├── Memory / Provenance
  └── Observability
       ↓
┌───────────────────────────────┬───────────────────────────────┐
│ CODEX CTO                     │ JULES CTO                     │
│ Local / Worktree / Cloud      │ Gemini 3.1 Pro Fleet         │
│ deep engineering              │ high-throughput async work    │
└───────────────┬───────────────┴───────────────┬───────────────┘
                ↓                               ↓
                         GitHub
                           ↓
                    PR → Actions → CI
                           ↓
                    Cross-Agent Review
                           ↓
                    Evidence Validator
                           ↓
                      Policy Gate
                           ↓
                      Claude Review
                           ↓
                       Human Merge
```

## Papéis

### Claude Code — CEO

Responsável por intenção, decisões arquiteturais, decomposição macro, priorização, resolução de conflitos e release readiness. Não é o executor padrão para builds pesados, lint em massa, backlog mecânico ou tarefas reproduzíveis que possam ir para Cloud.

### Maestri — sistema operacional

Maestri governa, não compete com os modelos. Centraliza contratos, contexto, dependências, conflitos, roteamento, quota, risco, hooks, estado, evidência, memória e telemetria.

### Codex — CTO Engineering

Responsável por deep repository reasoning, debugging complexo, refactors cross-module, migrations grandes, integração difícil, review e CI diagnosis. Modos: LOCAL, WORKTREE e CLOUD.

### Jules — CTO Cloud/Fleet

Responsável por work packages independentes, backlog, manutenção, docs, testes, bugs isolados e alto paralelismo. Modelo alvo: Gemini 3.1 Pro. Limites operacionais conhecidos devem ser tratados pelo Quota Guard, nunca hard-coded sem fonte atual.

### GitHub — control plane do código

GitHub é a fonte de verdade do código, branches, commits, PRs, checks e CI. Postgres é a fonte de verdade operacional do runtime e dos agentes.

## Universal TaskContract

O contrato universal deve suportar, no mínimo:

```text
id
parent_job
objective
context
source_of_truth
current_state
repo
base_branch
work_branch
scope
requirements
target_files
constraints
dependencies
conflicts
skill
allowed_tools
forbidden_actions
network_policy
secret_policy
verification
acceptance_criteria
risk_level
priority
timeout
preferred_provider
fallback_policy
requested_by
created_at
```

Nenhum provider recebe responsabilidade de inventar política global fora deste contrato.

## Prompt Compiler

O Prompt Compiler transforma TaskContract em um envelope específico do provider:

```text
# OBJECTIVE
# CONTEXT
# SOURCE OF TRUTH
# CURRENT STATE
# SCOPE
# REQUIREMENTS
# TARGETS
# CONSTRAINTS
# DEPENDENCIES
# VERIFICATION
# ACCEPTANCE CRITERIA
# DELIVERY
```

O objetivo é manter prompts curtos, específicos e reproduzíveis.

## Constituição compartilhada

A hierarquia recomendada:

```text
/AGENTS.md
/packages/maestri/AGENTS.md
/apps/web/AGENTS.md
/services/*/AGENTS.md
```

Regras permanentes vivem em AGENTS.md; metodologia em Skills; trabalho atual em TaskContract.

## Skills compartilhadas

Estrutura alvo:

```text
.agents/skills/
├── implement-feature/
├── debug-complex-bug/
├── repository-audit/
├── architecture-review/
├── database-migration/
├── frontend-validation/
├── test-generation/
├── security-review/
├── fix-ci/
├── dependency-upgrade/
├── performance-review/
├── documentation/
└── release-validation/
```

## Master Planner e Work Packages

Planos grandes não são convertidos diretamente em uma task por etapa. O Master Planner agrupa semanticamente, detecta dependências e conflitos e cria Work Packages coerentes.

```text
Master Goal
  ↓
Master Planner
  ↓
Dependency Graph
  ↓
Work Package Compiler
  ↓
Conflict Graph
  ↓
READY queue
```

Um Work Package pode conter várias etapas internas do provider.

## Dependency Graph

Estados mínimos:

```text
BLOCKED
READY
QUEUED
DISPATCHED
PLANNING
WORKING
WAITING
VALIDATING
PR_CREATED
COMPLETED
FAILED
CANCELLED
```

Somente READY pode entrar no scheduler.

## Conflict Graph

Dependência lógica e conflito de arquivos são problemas diferentes. Tasks que podem tocar os mesmos módulos/arquivos devem ser serializadas ou particionadas mesmo quando não existe dependência funcional explícita.

## Execution Router

Rotas possíveis:

```text
CODEX_LOCAL
CODEX_WORKTREE
CODEX_CLOUD
JULES_FLEET
JULES_SWARM
CLAUDE_REVIEW
HUMAN_APPROVAL
```

O router considera fit da skill, risco, cloud compatibility, quota, prioridade, latência, conflitos e recursos.

## Codex CTO — modos

### Local
Para feedback imediato, integração com Windows/hardware, BrowserMesh, ferramentas locais e debugging dependente do host.

### Worktree
Para isolamento paralelo local. Regra: um Work Package por workspace isolado.

### Cloud
Prioridade para workloads reproduzíveis: repo analysis, coding, build, lint, typecheck, testes, refactors, migrations, dependency work, docs, review e CI diagnosis. O PC deve ser control plane; Cloud deve assumir o máximo de compute possível.

## Codex Cloud Environment Manager

O ambiente alvo deve ser mínimo e reproduzível:

```text
Node
pnpm
Python
Git
dependencies
build tools
test tools
setup scripts
environment variables
network policy
```

Não instalar “o universo inteiro”. Reutilizar cache/estado quando suportado, mas nunca assumir persistência sem verificação.

## Cloud-First Router

Regra:

```text
reproduzível?
  ↓ sim
cloud-capable?
  ↓ sim
sem requisito de hardware/local?
  ↓ sim
OFFLOAD
```

Se não, Worktree/Local.

## Network Policy

Perfis:

```text
OFF
SETUP_ONLY
DEPENDENCIES
DOCUMENTATION_ALLOWLIST
SERVICE_ALLOWLIST
FULL
```

Default: OFF. FULL é excepcional.

## Secret Policy

Agent != Secret Store. Secret Manager continua autoridade. Valores nunca entram em Git, logs, prompts persistentes ou evidence payloads. Somente referências e grants mínimos.

## Jules Fleet

Jules recebe Work Packages independentes e paralelizáveis. Uma task Jules pode conter vários PlanSteps. Não mapear etapa = task.

Capacidade operacional deve ser governada por Quota Guard e Fleet Scheduler. Reservar parte da concorrência para urgência/recovery quando isso fizer sentido.

## Jules Plan Validator

Quando Jules gerar plano, Maestri compara:

```text
scope
requirements
constraints
dependencies
target areas
acceptance criteria
risk
```

Saídas:

```text
PASS
REVISE
BLOCK
```

## Auto-approval por risco

```text
R0 docs/read/tests            → AUTO
R1 isolated normal code       → AUTO
R2 important module           → VALIDATOR
R3 infra/security             → CLAUDE
R4 prod/main/secrets/IAM      → HUMAN
```

## Jules Swarm

Modo excepcional para um mesmo problema quando vale explorar várias abordagens. Deve consumir budget explícito e nunca ser default.

## Codex Usage Governor

Codex não recebe um limite de concorrência inventado. O governor observa uso disponível, classe de tarefa, local/cloud, prioridade e pressão de uso.

Classes:

```text
TINY
LIGHT
NORMAL
HEAVY
EXCLUSIVE
```

## Resource Router

Heurística inicial:

```text
TINY       → Jules / Codex Local
LIGHT      → Jules
NORMAL     → Jules ou Codex Cloud
HEAVY      → Codex Cloud
EXCLUSIVE  → Codex + Claude supervision
```

Sempre subordinada a risco, quota, skill fit e compatibilidade.

## Failure Classifier

Categorias mínimas:

```text
TRANSIENT
BAD_PROMPT
BAD_PLAN
CODE_ERROR
TEST_FAILURE
CI_FAILURE
DEPENDENCY
ENVIRONMENT
AUTH
QUOTA
CONFLICT
ARCHITECTURE
POLICY
UNKNOWN
```

Não existe fallback cego.

## Escalation Engine

```text
TRANSIENT     → retry same provider
BAD_PROMPT    → Prompt Compiler
BAD_PLAN      → replan same session/provider
TEST_FAILURE  → same agent
CI_FAILURE    → CI remediation
QUOTA         → queue or alternate provider
COMPLEX_CODE  → Codex
ARCHITECTURE  → Claude
POLICY        → block
UNKNOWN       → Claude diagnosis
```

## Cross-Agent Review

Builder e reviewer podem ser providers diferentes. Exemplos:

```text
Jules → Codex Review
Codex → Jules/CI Validation
R3 → Builder → Independent Reviewer → Claude
```

## Branch Strategy

Cada WP deve usar branch/contexto isolado:

```text
maestri/jules/<task-id>
maestri/codex/<task-id>
```

Nunca permitir fleet concorrente em main.

## Evidence Validator

“Agent says done” nunca equivale a COMPLETED.

ExecutionResult/TaskResult deve incluir:

```text
status
summary
files_changed
tests_requested
tests_executed
tests_passed
lint
typecheck
build
runtime_validation
commit
branch
pr
ci
artifacts
errors
warnings
evidence
follow_up
```

COMPLETED exige acceptance criteria + evidence + checks + policy.

## Hook Engine

Eventos mínimos:

```text
before_task
before_route
after_route
before_dispatch
after_dispatch
on_started
on_plan
before_plan_approval
after_plan_approval
on_progress
on_tool_call
on_waiting
on_rate_limit
before_commit
after_commit
before_pr
after_pr
on_ci_failure
on_security_failure
on_timeout
on_agent_failure
before_complete
on_complete
before_merge
after_merge
```

## Policy Engine

Políticas críticas são determinísticas e externas ao prompt. Exemplos: main merge, produção, secrets, IAM, deploy e escrita externa.

## Memory e provenance

Três domínios:

```text
PROJECT MEMORY
AGENT MEMORY
TASK MEMORY
```

Toda memória relevante deve carregar source, timestamp, confidence, task, commit/PR e provider.

## Postgres e GitHub

```text
GitHub = code truth
Postgres = operational truth
```

Tabelas alvo:

```text
agents
agent_runtime_state
agent_jobs
agent_tasks
agent_events
task_dependencies
task_conflicts
task_attempts
agent_usage
agent_session_usage
approvals
evidence
incidents
host_nodes
host_metrics
notifications
```

## Scheduler e Queue

Scheduler considera prioridade, dependências, conflitos, risco, provider, quota, resource class, idade e retry count.

Filas:

```text
urgent
high
normal
low
maintenance
```

Estados de espera:

```text
WAITING_DEPENDENCY
WAITING_RESOURCE
WAITING_QUOTA
WAITING_APPROVAL
```

## PC Resource Guard

Monitorar CPU, RAM, swap, disco e rede. Quando o host estiver pressionado, reduzir dispatch local e preferir Codex Cloud/Jules para workloads reproduzíveis.

## Observabilidade

Cada execução deve correlacionar:

```text
timestamp
trace_id
job_id
task_id
agent_id
provider
execution_id
context_packet_id
event
duration
usage
tools
files
policy
retry
terminal_status
```

## Command Center

A UI deve expor, no mínimo:

```text
Claude CEO status
Codex local/worktree/cloud
Jules running/capacity/quota
READY/RUNNING/BLOCKED/WAITING/FAILED/COMPLETED
Dependency Graph
Conflict Graph
quota/usage pressure
branch/PR/CI
task evidence
```

## Definition of Done universal

Nenhum Work Package termina sem:

```text
requirements satisfied
acceptance criteria satisfied
tests executed
lint/typecheck/build when applicable
no unresolved critical findings
commit exists
PR when required
CI successful when required
evidence persisted
```

## Estrutura alvo do repositório

```text
Lumenva/
├── AGENTS.md
├── docs/
│   └── MAESTRI_AGENT_ARCHITECTURE.md
├── .agents/
│   └── skills/
├── .claude/
│   ├── agents/
│   ├── skills/
│   └── hooks/
├── .codex/
│   └── config.toml
├── .github/
│   ├── workflows/
│   └── agentic-workflows/
└── packages/
    └── maestri/
        ├── core/
        ├── contracts/
        ├── planner/
        ├── dependencies/
        ├── conflicts/
        ├── compiler/
        ├── router/
        ├── scheduler/
        ├── queue/
        ├── quota/
        ├── resources/
        ├── policies/
        ├── hooks/
        ├── evidence/
        ├── failures/
        ├── escalation/
        ├── memory/
        ├── telemetry/
        └── adapters/
            ├── claude/
            ├── codex/
            │   ├── local/
            │   ├── worktree/
            │   └── cloud/
            ├── jules/
            └── github/
```

## Fases de implementação

```text
0  Audit + freeze architecture
1  Universal contracts
2  State machine
3  AGENTS.md hierarchy
4  Skills
5  Prompt Compiler
6  Dependency Graph
7  Conflict Graph
8  Policy Engine
9  Hook Engine
10 GitHub Adapter
11 Codex Adapter
12 Codex Cloud Environment
13 Cloud Execution Router
14 Jules Adapter
15 Jules/Gemini provider setup
16 Jules Quota Guard
17 Fleet Scheduler
18 Plan Validator
19 Failure Classifier
20 Escalation Engine
21 Evidence Validator
22 Cross-Agent Review
23 CI integration
24 Memory/provenance
25 Telemetry
26 Resource Guard
27 Cloud-first offloading
28 Command Center
29 Fleet UI
30 Dependency Graph UI
31 Quota/usage UI
32 End-to-end tests
33 Chaos/failure tests
34 Security validation
35 Production hardening
```

## E2E final de aceite

```text
Owner asks for Feature X
  ↓
Claude CEO creates Master Goal
  ↓
Maestri creates Work Packages
  ↓
Dependency + Conflict Graph
  ↓
Router sends independent WPs to Codex Cloud/Jules
  ↓
isolated branches/workspaces
  ↓
tests + PRs
  ↓
cross-agent review
  ↓
GitHub Actions
  ↓
Evidence Validator
  ↓
unlock dependent wave
  ↓
Claude final review
  ↓
Policy Gate
  ↓
READY FOR HUMAN MERGE
```

O PC deve permanecer majoritariamente como control plane; compute reproduzível deve ser offloaded para Cloud sempre que permitido pelo contrato, pela policy e pela disponibilidade do provider.

## Integração com o plano dos três gates externos

O plano `docs/superpowers/plans/2026-09-22-maestri-v3-first-three-external-gates.md` permanece válido e passa a ser tratado como o primeiro bloco de gates externos deste blueprint. Ordem:

1. validar GitHub Actions reais para Jules/Codex;
2. validar Graphiti remoto sem Docker;
3. validar collector OTLP opcional;
4. somente então continuar as fases cloud/fleet que dependem desses gates.

Nenhum destes gates autoriza merge em `main`, deploy de produção ou criação automática de secrets.
