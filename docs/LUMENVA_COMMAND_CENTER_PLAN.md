
# Lumenva Command Center

## Visão

O Lumenva Command Center será o ambiente desktop próprio da Lumenva para operar, observar e coordenar agentes de IA locais e remotos.

A meta não é criar apenas uma dashboard ou wrapper de terminal. O produto deve funcionar como um Agent Operating System com:

- canvas visual de agentes
- terminais PTY reais
- runtime próprio
- MCG como kernel de contexto
- scheduler e DAG de tarefas
- roteamento por capacidade, risco e custo
- telemetria e traces
- memória em camadas
- evidências e artefatos
- budgets e alertas
- validação A/B
- replay
- métricas de eficiência e confiança

O Maestri pode continuar sendo usado durante a transição, mas o objetivo final é que o Lumenva Command Center seja independente.

## Princípios

1. Dados reais antes de UI.
2. Executor diferente de Verifier.
3. Exact > Estimated > Unavailable.
4. Contexto é um recurso: medir, compilar, deduplicar, cachear e versionar.
5. Event-driven sempre que possível.
6. Local-first.
7. Segurança por capacidade.
8. Fechar a UI não deve encerrar o Core nem perder sessões.

## Arquitetura alvo

OWNER
  -> LUMENVA COMMAND CENTER
     -> DESKTOP UI
        -> Canvas
        -> Agent Nodes
        -> Terminal View
        -> Tasks
        -> Traces
        -> Alerts
     -> LUMENVA CORE
        -> Event Bus
        -> Scheduler
        -> Router
        -> Policies
        -> Storage
        -> Context Engine / MCG
           -> Claude CEO
           -> Codex CTO
           -> Antigravity CIO
        -> Tools / MCPs
        -> Telemetry / Evidence / Alerts
        -> Validation Lab
        -> Trust / Efficiency

## Stack inicial

Desktop:
- Electron
- React
- TypeScript
- Vite

Runtime:
- Node.js
- TypeScript

Terminal:
- xterm.js
- node-pty
- Windows ConPTY

Storage:
- SQLite
- WAL
- append-only event journal

Git isolation:
- git worktree

Observability:
- OpenTelemetry-style traces

Testing:
- node:test ou Vitest
- Playwright para UI

## Desktop x Core

Criar dois processos independentes:

- lumenva-core
- lumenva-desktop

O Core mantém agents, PTYs, tasks, scheduler, MCG, event bus, telemetry, traces, storage e alerts.

O Desktop apenas apresenta e controla o Core através de uma API local tipada.

Fechar o Desktop não deve matar agentes ou tarefas.

## Agent Runtime

Cada agente deve ter um manifesto próprio com:

- id
- name
- role
- executable/runtime
- workspace isolation
- policy/risk
- context policy
- telemetry
- defaults de reasoning

Presets iniciais:
- Claude CEO
- Codex CTO
- Codex Reviewer
- Codex Tester
- Codex MCG
- Antigravity CIO

## Canvas e Agent Nodes

A entidade central da UI será o Agent Node, não o terminal.

Cada node mostra:
- nome
- role
- status
- task atual
- progresso por critérios
- tokens
- contexto
- runtime
- risco
- duração
- attention state

Estados:
- ACTIVE
- WORKING
- WAITING
- NEEDS_APPROVAL
- BLOCKED
- FAILED
- DONE
- OFFLINE

Ao abrir um node:
- Overview
- Terminal
- Task
- Context
- Memory
- Tools
- MCPs
- Plugins
- Artifacts
- Evidence
- Trace
- Usage
- Logs

## Terminal real

Fluxo:

React/xterm.js
  <-> typed IPC
  <-> PTY Manager
  <-> node-pty / ConPTY
  <-> Claude / Codex / Antigravity / PowerShell

O terminal é uma visualização do Agent Runtime.

Não permitir execução arbitrária diretamente pelo renderer.

## Prompt Composer

Criar um composer global por agente com drafts persistentes.

Suportar:
- @agent
- @task
- @artifact
- @evidence
- @trace
- @memory
- @decision
- @workspace
- #arquivo

Características:
- draft independente por agente
- Shift+Enter para nova linha
- Enter para enviar
- anexos
- imagens
- large paste colapsado
- histórico recente

## Command Palette

Criar paleta global com Ctrl+P.

Deve localizar e executar:
- agentes
- tasks
- workspaces
- arquivos
- artifacts
- traces
- alerts
- commands

## Event Bus

Eventos principais:
- agent.started
- agent.waiting
- agent.finished
- agent.failed
- task.created
- task.updated
- task.completed
- tool.called
- mcp.called
- plugin.used
- context.compiled
- context.cache.hit
- context.cache.miss
- budget.warning
- budget.critical
- alert.created
- evidence.created
- artifact.created
- validation.completed

Consumidores:
- Dashboard
- Telemetry
- Scheduler
- Router
- Alerts
- CEO Brief
- Validation Lab

## MCG como Context Kernel

O MCG atual deve evoluir para um pacote nativo do Command Center.

Componentes:
- Context Compiler
- layered memory
- context diff
- context cache
- artifact references
- evidence graph
- telemetry
- traces
- validation

Categorias do Context Compiler:
- must_keep
- constraints
- decisions
- acceptance_criteria
- evidence
- recent
- unresolved
- project_memory
- historical
- disposable

Itens críticos nunca são descartados por simples limite de tamanho.

## Memória em camadas

- L0 Current Turn
- L1 Current Task
- L2 Current Session
- L3 Project Memory
- L4 Decisions / ADR
- L5 Evidence Archive

Todo item deve manter provenance.

## Context Diff e Cache

Evitar reenviar contexto inteiro.

Medir:
- cache_hits
- cache_misses
- cache_hit_rate
- delta_chars
- delta_reuse_percent
- estimated_tokens_avoided

Cada bloco recebe hash estável.

## Tasks como DAG

Uma task pode virar um grafo:

Migration
- Research
- Architecture
- Backend
- Frontend
- Integration
- Tests
- Review

Cada node:
- node_id
- task_id
- depends_on
- executor
- status
- risk
- budget
- input
- output
- evidence

Nodes independentes podem executar em paralelo.

## Worktree Manager

Cada executor de código pode receber worktree isolado.

Registrar:
- repo
- base commit
- branch
- worktree
- task
- agent
- diff
- tests

Nunca fazer merge automático.

## Resource Router

Classificar jobs:
- TINY
- LIGHT
- NORMAL
- HEAVY
- EXCLUSIVE

Considerar:
- type
- risk
- context size
- expected tools
- model availability
- reliability
- budget

Adaptive reasoning:
- TINY -> low
- LIGHT -> low
- NORMAL -> medium
- HEAVY -> high
- CRITICAL -> high + independent verification

## Risk Router

- R0: read-only
- R1: workspace edit
- R2: dependency/config
- R3: cloud/auth/database/infra
- R4: production/delete/security/secrets

Política inicial:
- R0/R1: automático dentro dos limites
- R2: execução + review
- R3: Owner approval
- R4: Owner approval + independent validation

## Capability Registry

Criar registry para:
- agents
- tools
- plugins
- MCPs
- runtimes
- models

Campos:
- name
- version
- capabilities
- health
- last_seen
- success_rate
- failure_rate
- latency
- usage
- measurement_type

O Router usa isso antes de delegar.

## Traces e Telemetria

Hierarquia:
trace_id -> session_id -> task_id -> turn_id -> span_id

Cada span pode registrar:
- agent
- executor
- runtime
- model
- provider
- tool
- plugin
- MCP
- duration
- input_tokens
- cached_input_tokens
- output_tokens
- reasoning_tokens
- total_tokens
- measurement_type
- status
- source

Nunca armazenar secrets.

## Métricas corretas

Separar explicitamente:

Compression Ratio:
quanto o MCG reduziu no contexto que processou.

MCG Coverage:
quanto do workflow realmente passou pelo MCG.

Real Workflow Savings:
economia do workflow inteiro.

Nunca tratar compression como economia real.

Prioridade:
EXACT > tokenizer > chars/4 > UNAVAILABLE

## Plugin, Tool e MCP Attribution

Nunca dizer que um plugin economizou tokens apenas porque estava ativo.

Separar:
- observed usage
- causal saving

Causal saving somente após A/B.

Registrar tools e MCPs por trace/task.

## Budgets e Alertas

Thresholds default:
- WARNING >= 50%
- CRITICAL >= 80%

Dimensões:
- global
- executor
- agent
- model
- plugin
- MCP
- tool
- runtime

Alertas comportamentais:
- TOKEN_SPIKE
- RETRY_STORM
- TOOL_LOOP
- CONTEXT_CHURN
- AGENT_STUCK
- MCP_SPIKE
- PLUGIN_SPIKE
- LATENCY_SPIKE
- ERROR_STORM

## CEO Inbox e Executive Brief

Formato do brief:
- Goal
- Status
- Completed
- Blocked
- Risks
- Decision Required
- Evidence
- Next Recommended Action

Status de entrega:
- queued
- delivered
- acknowledged
- unavailable

Nunca marcar delivered sem prova.

## Artifacts, Evidence e Decisions

Artifact Registry:
- code
- report
- test result
- research
- diff
- screenshot
- migration
- evidence bundle

Evidence Graph:
Claim -> Evidence -> Source -> Artifact -> Task -> Trace

Decision Log / ADR:
- decision
- reason
- date
- approved_by
- status
- supersedes
- evidence

## Reliability, Retry e Circuit Breaker

Medir:
- success rate
- failure rate
- retry rate
- latency
- tokens/task
- blocked rate

Retry inteligente:
1. normal
2. contexto menor / estratégia ajustada
3. tool alternativa
4. executor/model alternativo quando permitido
5. BLOCKED

Circuit breaker abre quando um runtime começa a falhar repetidamente.

Dead Letter Queue para tasks definitivamente falhas.

## Semantic Deduplication

Antes de iniciar task:
- verificar equivalentes ativas/recentes
- evitar duplicação acidental
- nunca usar dedup inseguro para operações destrutivas

## Progress e Confidence

Progress deriva de acceptance criteria.

Exemplo:
7/10 critérios PASS = 70%

Confidence deriva de:
- tests
- typecheck
- evidence coverage
- independent review
- unresolved issues

Não usar confiança subjetiva do modelo.

## Validation Lab

Comparar BASELINE vs MCG com:
- mesma task
- mesmo model
- mesmo effort
- mesmo commit
- mesmas tools
- mesma network policy
- mesmo workspace inicial

Usar worktrees/snapshots isolados.

Medir:
- task success
- context recall
- evidence grounding
- hallucination rate
- constraint compliance
- tokens
- retries
- turns
- tool calls
- wall time
- P50/P95 latency

## Replay Mode

CLI futura:
- lumenva replay TASK_ID --baseline
- lumenva replay TASK_ID --mcg
- lumenva compare TASK_ID

Nunca alterar a task original.

## Efficiency e Trust Score

Efficiency deve considerar:
- real token savings
- task success
- context retention
- evidence grounding
- hallucination
- retry overhead
- latency overhead

Antes de dataset mínimo: UNVALIDATED

Dataset mínimo inicial: 30 paired tasks.

Estados:
- UNVALIDATED
- VALIDATING
- VALIDATED
- DEGRADED
- FAILED

## Regression Watch

Toda mudança importante do Context Engine deve poder rodar smoke eval.

Se success cai, recall cai, hallucination sobe, tokens sobem ou retries sobem:
REGRESSION DETECTED

## Cost of Progress

Medir:
- tokens por critério concluído
- tokens por percentual real de progresso

## Dashboard

Organizar por três perguntas.

O que está acontecendo?
- agents
- tasks
- runtimes
- tools
- plugins
- MCPs

O que está custando?
- tokens
- retries
- context
- latency
- anomalies
- top consumers
- cost of progress

O MCG está ajudando?
- compression
- coverage
- real savings
- recall
- hallucination
- A/B
- replay
- Efficiency Score
- Trust Score

## Trace View

Exemplo:
Claude CEO -> Context Compiler -> MCG -> Codex CTO -> Tool -> MCP -> Result -> Judge -> PASS

Cada span:
- duration
- tokens
- status
- runtime
- model
- measurement type
- errors

## UX inspirada em canvas espacial

Conceitos desejados:
- infinite canvas
- agent nodes
- connections
- groups
- minimap
- zoom
- keyboard navigation
- lifted/docked panels
- notes
- file tree
- portals futuramente
- templates de equipes
- attention state
- command palette
- prompt composer

Não copiar código ou implementação proprietária de terceiros.

## Acessibilidade

Meta explícita: WCAG 2.2 AA

Requisitos:
- navegação completa por teclado
- foco visível
- atalhos remapeáveis
- suporte a screen reader
- labels semânticas
- contraste adequado
- não depender apenas de cor
- zoom
- terminal font scaling
- reduced motion
- dark/light/system
- suporte a IME/CJK
- layouts não-QWERTY

## Segurança Desktop

Renderer sem acesso direto a Node.

Fluxo:
React Renderer -> Preload Bridge -> Typed IPC -> Main/Core -> OS

Não expor shell arbitrário para o renderer.

O app não roda como administrador por padrão.

## Lumenva Link

Criar futuramente protocolo próprio local/remoto.

Funções:
- workspace state
- agent state
- terminal stream
- event stream
- capabilities
- role/capability negotiation
- remote client

Clientes futuros:
- Desktop
- CLI
- Web local
- iPhone/iPad

Durante transição, Maestri Wire pode ser bridge temporária.

## Migração gradual a partir do Maestri

M0: MCG atual estabilizado.
M1: Criar Lumenva Core.
M2: Criar Desktop shell.
M3: Ler estado existente via bridge.
M4: Canvas e Agent Nodes próprios.
M5: Terminal próprio xterm.js + node-pty.
M6: Claude/Codex/Antigravity rodando no Lumenva Runtime.
M7: Scheduler, DAG e Worktrees próprios.
M8: Lumenva Link próprio.
M9: Maestri deixa de ser dependência.

## Primeiro milestone executável

Entregar:
1. lumenva-core
2. Electron shell
3. um terminal xterm.js/node-pty
4. Codex rodando dentro do terminal
5. persistência SQLite
6. Event Bus
7. MCG conectado
8. telemetry básica
9. Agent Node do Codex
10. reabrir a UI sem perder o Core

Acceptance:
Lumenva Desktop -> Lumenva Core -> PTY real -> Codex real -> MCG -> Telemetry

Tudo funcionando end-to-end.

## Estrutura inicial do repositório

apps/
- desktop/
- core/
- cli/

packages/
- contracts/
- agent-runtime/
- terminal-runtime/
- event-bus/
- scheduler/
- router/
- context-engine/
- memory/
- telemetry/
- traces/
- evidence/
- artifacts/
- git-worktrees/
- policies/
- validation/
- storage/
- bridge/

config/
tests/
docs/

## Definition of Done

PASS:
funciona end-to-end com evidência real.

PARTIAL:
parte funciona e a limitação está documentada.

BLOCKED:
bloqueio técnico específico e comprovado.

Não aceitar como PASS:
- mock
- endpoint vazio
- []
- null
- placeholder
- future
- prepared
- métrica inventada

## Restrições

- Não fazer deploy automático.
- Não fazer push/merge automático por agentes.
- Não apagar evidências.
- Não executar ações destrutivas sem Owner approval.
- Não expor secrets.
- Não remover controles de segurança.
- Não confundir estimativa com dado exato.

## Ordem de implementação

1. Core + contracts + event bus
2. terminal runtime
3. agent runtime
4. MCG/context engine
5. storage + telemetry + traces
6. canvas + Agent Nodes
7. scheduler + DAG + worktrees
8. router + risk + capabilities
9. evidence + artifacts + CEO brief
10. budgets + alerts
11. Validation Lab + replay
12. Efficiency/Trust/Regression
13. Lumenva Link
14. mobile/remote
15. refinamento visual

## Status inicial

PLANNING

Este documento é a fonte de verdade inicial da branch Lumenva Command Center.

O próximo passo é quebrar o plano em milestones pequenos e verificáveis antes de iniciar implementação ampla.
