# Lumenva Command Center — Master Blueprint V2

Status: PLANNING
Branch: lumenva-command-center-blueprint-v2

## 0. Objetivo

O Lumenva Command Center será o sistema operacional local-first da Lumenva para criar, executar, observar e coordenar agentes de IA.

Não é apenas dashboard, canvas ou terminal. É um produto com:

- Control Plane determinístico
- Agent Runtime real
- Context Engine / MCG
- Execution Engine
- Observability
- Evaluation
- UI desktop
- Office visual em pixel
- memória compartilhada sem substituir a memória nativa dos providers
- criação padronizada de agents com Agent Architect + compiler

Princípio central:

AI proposes.
Lumenva Core decides.
Agents execute.
Evidence proves.
Owner authorizes high-risk actions.

---

# 1. Arquitetura clean

A arquitetura deve ser pequena, com poucos blocos centrais.

~~~text
OWNER
  |
  v
LUMENVA COMMAND CENTER
  |
  +-- Desktop UI
  |
  +-- Lumenva Core
      |
      +-- 1. Control Plane
      +-- 2. Agent Runtime
      +-- 3. Context Engine
      +-- 4. Execution Engine
      +-- 5. Observability
      +-- 6. Evaluation
~~~

Evitar microserviços locais desnecessários.

Não criar daemons separados para context, scheduler, telemetry, office ou validation.

Processos principais:

~~~text
lumenva-desktop
lumenva-core
~~~

Fechar a UI não deve encerrar os agents ou tasks ativas.

---

# 2. Desktop x Core

## Desktop

Responsabilidades:

- renderizar UI
- receber eventos
- apresentar estado
- enviar intenções do usuário
- Office / Pixel Floor
- Terminal
- Work
- Observe
- Settings

Não controla shell diretamente.
Não é autoridade de estado.

## Core

Responsabilidades:

- estado canônico
- lifecycle
- routing
- policies
- approvals
- runtime
- tasks
- context
- telemetry
- persistence
- evidence
- evaluation

O Core continua ativo mesmo se o Desktop fechar.

---

# 3. Control Plane

O Control Plane é a autoridade técnica do sistema.

Agrupa:

- policies
- capabilities
- approvals
- risk
- budgets
- routing
- lifecycle
- state machine
- retry policy
- circuit breaker

Não criar um engine separado para cada uma dessas funções.

## Task lifecycle

~~~text
DRAFT
-> PLANNED
-> WAITING_APPROVAL
-> APPROVED
-> QUEUED
-> RUNNING
-> VERIFYING
-> REVIEW
-> PASSED / FAILED / BLOCKED
-> COMPLETED
~~~

O texto do agent não muda o estado sozinho.

Agent dizer "done" gera no máximo EXECUTION_FINISHED.
O Core valida critérios, evidência e verifier antes de concluir.

---

# 4. Risk model

Níveis:

- R0 = read-only
- R1 = workspace edit
- R2 = dependency/config
- R3 = cloud/auth/database/infra
- R4 = production/delete/security/secrets

Política inicial:

- R0/R1: automático dentro dos limites
- R2: execução + review
- R3: Owner approval
- R4: Owner approval + independent validation

O app não roda como administrador por padrão.

---

# 5. Approval Gate

Toda ação que exige autorização deve gerar um approval explícito.

Campos:

- approval_id
- task_id
- trace_id
- agent
- action
- risk
- reason
- evidence
- created_at
- status

Status:

- PENDING
- APPROVED
- REJECTED
- EXPIRED
- CONSUMED

Aprovação deve ser específica, auditável e limitada.

---

# 6. Agent Runtime

O Agent Runtime executa processos reais.

Agrupa:

- agent registry
- sessions
- PTY
- process lifecycle
- provider adapters
- presets
- activity
- attention
- health

Adapters iniciais:

- ClaudeAdapter
- CodexAdapter
- AntigravityAdapter
- PowerShellAdapter

Fluxo:

~~~text
UI
-> Core
-> Agent Runtime
-> node-pty / ConPTY
-> claude.exe / codex.exe / agy.exe / pwsh.exe
~~~

O Runtime não decide política.
Ele executa apenas o que o Control Plane permitiu.

---

# 7. Agent states

Estados canônicos:

- ACTIVE
- WORKING
- WAITING
- NEEDS_APPROVAL
- BLOCKED
- FAILED
- DONE
- OFFLINE

Attention é separado de activity.

---

# 8. Lumenva Agent Standard

Todos os agents nascem a partir de uma definição canônica.

Estrutura:

~~~text
.lumenva/
  agents/
    defaults/
      lumenva-default.yaml
    profiles/
      architect.yaml
      builder.yaml
      researcher.yaml
      reviewer.yaml
      operator.yaml
    definitions/
      claude-ceo.yaml
      codex-cto.yaml
      antigravity-cio.yaml
    schema/
      agent.schema.json
~~~

Não manter três configurações independentes como fonte de verdade.

Fonte real:

~~~text
Lumenva Agent Spec
        |
        v
Deterministic Compiler
   |       |       |
 Claude   Codex   Gemini
~~~

---

# 9. Lumenva Agent Default

Todo agent herda um DNA comum.

Exemplo conceitual:

~~~yaml
version: 1

runtime:
  provider: auto
  model_policy: adaptive
  reasoning: adaptive

context:
  strategy: pull
  progressive_disclosure: true
  graph_first: true
  broad_repo_scan: false

memory:
  mode: overlay
  native:
    preserve: true
  shared:
    provider: obsidian
    retrieval: pull
  code:
    provider: graphify

permissions:
  principle: least-privilege
  risk_default: R1

execution:
  plan_before_complex_work: true
  acceptance_criteria_required: true
  evidence_required: true

observability:
  events: true
  traces: true
  usage: true

office:
  spawn: automatic
  zone: auto
  desk: auto
  avatar: auto
~~~

O agent novo altera apenas o necessário.

---

# 10. Agent profiles

Poucos profiles, bem definidos.

## architect

- design
- análise
- plano
- read-only por padrão
- reasoning alto
- produz trade-offs, riscos, DAG e acceptance criteria

## builder

- implementação
- testes
- workspace write
- worktree quando paralelo

## researcher

- pesquisa
- exploração
- leitura
- uso de ferramentas externas permitidas

## reviewer

- verificação independente
- não implementa a própria correção
- reasoning alto

## operator

- ações operacionais limitadas
- fortemente policy-gated

Evitar dezenas de personas redundantes.

---

# 11. Agent Architect

Criar um agent especializado em projetar novos agents.

Nome:

lumenva-agent-architect

Responsabilidade:

Transformar uma descrição curta em uma Lumenva Agent Spec válida, mínima e segura.

Exemplo:

~~~text
"Cria um especialista em arquitetura de banco read-only."
~~~

Saída:

~~~yaml
id: database-architect
name: Database Architect
profile: architect

mission:
  Review and design database architecture.

specialty:
  - databases
  - migrations
  - data-modeling

risk_max: R1
~~~

O resto é herdado do default.

O Agent Architect NÃO escreve configs específicas de provider manualmente.

---

# 12. Agent compiler

Criar uma CLI nossa:

~~~text
agentctl
~~~

Comandos iniciais:

- agentctl create
- agentctl validate
- agentctl compile
- agentctl sync
- agentctl diff
- agentctl doctor
- agentctl memory doctor

Fluxo:

~~~text
Agent Architect
-> canonical agent.yaml
-> schema validation
-> policy validation
-> compiler
-> Claude / Codex / Gemini renderer
-> registry
-> agent.created
~~~

Renderers:

- ClaudeRenderer
- CodexRenderer
- GeminiRenderer

---

# 13. Agent creation gate

Novo agent só nasce se:

- schema válido
- unique id
- mission definida
- profile válido
- tools least-privilege
- risk ceiling válido
- memory policy herdada
- Graphify policy herdada
- output contract presente
- provider configs compilam
- office metadata válida

Caso contrário:

AGENT_INVALID

---

# 14. Memory architecture

Não substituir a memória nativa de Claude, Codex ou Gemini.

Arquitetura:

~~~text
Claude native memory
Codex native config/memory
Gemini native memory
        |
        +---- preserved
        |
        v
Lumenva Memory Bridge
        |
   +----+----+
   |         |
Obsidian   Graphify
~~~

Nunca:

- mover ~/.claude
- mover ~/.codex
- mover ~/.gemini
- symlinkar esses diretórios
- substituir memory nativa
- usar junctions para forçar paths

---

# 15. Native memory overlay

Memória nativa:

- preservada
- provider-specific
- cache/scratch/local behavior
- nunca é apagada automaticamente

Shared memory:

- projeto
- decisões
- arquitetura aprovada
- lessons duráveis
- handoffs
- incidents
- project state

O shared layer NÃO sincroniza automaticamente toda memória nativa.

Usar Promotion, não Sync.

~~~text
native memory
    |
durable/shareable?
    |
    v
Memory Promotion
    |
    v
Obsidian
~~~

---

# 16. Memory Bridge

Criar:

~~~text
~/.lumenva/
  memory/
    bridge/
      policy.md
      claude.md
      codex.md
      gemini.md
    state/
      bridge.json
~~~

O bridge contém apenas instruções curtas.

Regras:

- Obsidian = shared durable project memory
- Graphify = code intelligence
- retrieval sob demanda
- nunca carregar o vault inteiro
- não duplicar fatos
- não armazenar secrets
- reportar conflito
- não substituir memória nativa

---

# 17. Memory integration strategy

## Claude

Manter CLAUDE.md e Auto Memory intactos.
Adicionar apenas bridge/import gerenciado.

## Codex

Manter AGENTS.md intacto.
Adicionar bloco delimitado e gerenciado.

## Gemini

Manter GEMINI.md e memória nativa.
Adicionar bridge/import gerenciado.

Marcadores:

~~~text
<!-- LUMENVA MEMORY BRIDGE:BEGIN -->
...
<!-- LUMENVA MEMORY BRIDGE:END -->
~~~

agentctl só altera esse bloco.

---

# 18. Memory Doctor

Criar:

~~~text
agentctl memory doctor
~~~

Valida:

- memória nativa intacta
- bridge presente
- Obsidian MCP acessível
- Graphify disponível
- project registry acessível
- import válido
- nenhum path quebrado

Nunca reparar substituindo arquivos inteiros.

---

# 19. Obsidian

Obsidian é a memória compartilhada canônica.

Stack inicial clean:

- Markdown
- Properties
- Bases
- Templates nativos
- um único MCP

Não instalar inicialmente múltiplos sistemas redundantes de retrieval.

Evitar no V1:

- Dataview
- Templater
- QuickAdd
- Smart Connections

Adicionar somente se houver necessidade medida.

---

# 20. Lumenva Brain

Estrutura:

~~~text
Lumenva-Brain/
  00-System/
    MEMORY_POLICY.md
    PROJECT_REGISTRY.md
    SCHEMA.md

  10-Projects/
    Lumenva/
      INDEX.md
      STATE.md
      Decisions/
      Architecture/
      Lessons/
      Handoffs/
      Incidents/

    RouteLex/
    Teacher/
    Helixforge/

  20-Shared/
    Infrastructure/
    AI/
    Security/
    Engineering/

  90-Generated/
    Graphify/
~~~

Não criar pastas de memória durável separadas para Claude/Codex/Gemini.

---

# 21. Memory schema

Tipos controlados:

- decision
- architecture
- lesson
- handoff
- incident
- project-state

Properties mínimas:

~~~yaml
type: decision
project: lumenva
status: active
created: YYYY-MM-DD
updated: YYYY-MM-DD
source: agent
author: agent-id
~~~

---

# 22. Graphify

Graphify é code intelligence reconstruível.

Não é fonte canônica de decisões.

Função:

- architecture graph
- imports
- functions
- classes
- schemas
- APIs
- dependencies
- impact analysis
- code navigation

Agents devem consultar Graphify antes de broad source scanning.

---

# 23. Graphify generated data

Tudo gerado deve ficar isolado.

Exemplo:

~~~text
90-Generated/
  Graphify/
    Lumenva/
      current/
~~~

Nunca escrever Graphify diretamente em:

- Decisions
- Architecture canônica
- STATE.md
- Lessons humanas

Generated data pode ser apagado e reconstruído.

---

# 24. Memory retrieval policy

Memória deve ser PULL, não PUSH.

Errado:

~~~text
session start
-> inject whole vault
~~~

Correto:

~~~text
task
-> identify project
-> read INDEX
-> read STATE
-> search relevant Decisions/Handoffs
-> query Graphify when code understanding is needed
-> open specific source only if needed
~~~

Objetivo:

reduzir tokens e contexto irrelevante.

---

# 25. Context Engine

MCG evolui para Context Engine nativo.

Agrupa:

- compiler
- memory retrieval
- cache
- delta
- artifact references
- decision retrieval
- evidence retrieval

No futuro, MCG deixa de ser conceito separado e passa a ser implementação do package context.

Categorias de contexto:

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

---

# 26. Context cache e delta

Evitar reenviar contexto inteiro.

Medir:

- cache_hits
- cache_misses
- cache_hit_rate
- delta_chars
- delta_reuse_percent
- estimated_tokens_avoided

Cada bloco recebe hash estável.

---

# 27. Execution Engine

Agrupa:

- tasks
- DAG
- scheduler
- worktrees
- dedup

Não criar engines separados para cada recurso.

Exemplo:

~~~text
Migration
  |- Research
  |- Architecture
  |- Backend
  |- Frontend
  |- Integration
  |- Tests
  '- Review
~~~

Nodes independentes podem executar em paralelo.

---

# 28. Worktrees

Para writes paralelos:

~~~text
main
|- worktree-task-A
|- worktree-task-B
'- worktree-task-C
~~~

Nunca dois executores escrevendo no mesmo workspace sem coordenação.

Antes de integração:

- tests
- diff
- review
- evidence

Sem merge automático.

---

# 29. Resource routing

O Router pertence ao Control Plane.

Considera:

- capability
- availability
- reliability
- complexity
- cost
- context size
- budget
- risk

Classificação:

- TINY
- LIGHT
- NORMAL
- HEAVY
- EXCLUSIVE

Reasoning:

- TINY -> low
- LIGHT -> low
- NORMAL -> medium
- HEAVY -> high
- CRITICAL -> high + independent verification

Não hardcode provider/model permanentemente.

---

# 30. Model policy

Agents definem policy, não nome fixo.

Exemplos:

- fast
- balanced
- strongest-appropriate

Adapters resolvem o modelo disponível.

Isso reduz quebra quando providers mudarem nomes ou capacidades.

---

# 31. Observability

Agrupar tudo em:

~~~text
Observability
|- Events
|- Traces
|- Usage
|- Metrics
|- Alerts
'- History
~~~

Não criar cinco sistemas separados para tool/plugin/MCP/runtime/agent telemetry.

Tudo vira event/span tipado.

Campos comuns:

- trace_id
- session_id
- task_id
- turn_id
- span_id
- parent_span_id
- agent
- executor
- runtime
- model
- provider
- tool
- plugin
- MCP
- duration
- tokens
- status
- source

---

# 32. Event Bus

Manter simples no V1.

Usar:

- event emitter local
- append-only event journal
- SQLite persistence quando necessário

Não usar Redis/Kafka/NATS no V1.

Eventos:

- agent.created
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
- approval.requested
- approval.granted
- budget.warning
- budget.critical
- evidence.created
- validation.completed

---

# 33. Metrics policy

Prioridade:

EXACT > tokenizer > chars/4 > UNAVAILABLE

Nunca transformar estimativa em dado exato.

Separar:

- compression ratio
- MCG coverage
- real workflow savings

Nunca dizer:

compression = real savings

---

# 34. Evaluation

Agrupar:

- replay
- A/B
- graders
- regressions
- scores

Não criar sistemas independentes para:

- recall
- hallucination
- confidence
- efficiency
- trust
- regression

Esses são resultados derivados.

---

# 35. Validation Lab

Comparar:

BASELINE vs MCG

Com:

- mesma task
- mesmo model policy
- mesmo effort
- mesmo commit
- mesmas tools
- mesma network policy
- mesmo workspace inicial

Medir:

- success
- recall
- evidence grounding
- hallucination
- constraint compliance
- tokens
- retries
- turns
- tool calls
- latency

---

# 36. Replay

CLI futura:

~~~text
lumenva replay TASK_ID --baseline
lumenva replay TASK_ID --mcg
lumenva compare TASK_ID
~~~

Replay nunca altera a task original.

---

# 37. Office / Pixel Floor

O Office é projeção visual do Core.

Nunca mantém estado autoritativo próprio.

~~~text
Lumenva Core
-> canonical state
-> Office projection
~~~

Objetivo:

mostrar agents trabalhando num escritório vivo em pixel art.

---

# 38. Office package

Manter simples:

~~~text
office/
|- world
|- agents
|- scenes
|- movement
'- renderer
~~~

Evitar criar Office Engine, Pixel Engine, World Engine, Spawn Engine e Visual Controller como pacotes separados.

---

# 39. Agent auto-spawn

Quando um agent é criado:

~~~text
agent.created
-> Office receives event
-> resolve role/profile
-> resolve zone
-> resolve desk
-> choose avatar
-> spawn
~~~

Prioridade:

1. role/profile
2. tags
3. compatible free desk
4. default spawn zone

Perfis sugeridos:

- architect -> Strategy / Architecture
- builder -> Engineering
- researcher -> Research Lab
- reviewer -> QA / Review
- operator -> Operations

---

# 40. Office visual states

Mapear estados reais para animações.

- IDLE
- WALKING
- THINKING
- READING
- CODING
- TOOL_USE
- WAITING
- REVIEWING
- BLOCKED
- NEEDS_APPROVAL
- FAILED
- DONE
- SYNCING
- DELEGATING

Exemplos:

- CODING -> sentado digitando
- THINKING -> bubble
- WAITING -> relógio
- BLOCKED -> alerta vermelho
- NEEDS_APPROVAL -> alerta amarelo
- DELEGATING -> desloca até outro agent/zone

---

# 41. Tool stations

Ferramentas podem ter representação visual.

Exemplos:

- Git -> Git Station
- Browser -> Research Station
- MCG -> Context Core
- Memory -> Memory Vault
- Tests -> QA Lab
- Deploy -> Deployment Room
- MCP -> MCP Hub

Movimento visual é observabilidade, não decisão operacional.

---

# 42. Scenario system

Cenários devem ser configuráveis sem hardcode.

Exemplo de estrutura:

~~~json
{
  "id": "lumenva-hq",
  "rooms": [],
  "objects": [],
  "stations": [],
  "spawnZones": [],
  "walls": [],
  "floor": {}
}
~~~

Assets:

~~~text
assets/
|- agents/
|- furniture/
|- decorations/
|- rooms/
|- effects/
'- themes/

scenarios/
|- lumenva-hq.json
|- engineering.json
'- research-lab.json
~~~

---

# 43. Scene Editor

Editor visual futuro:

- drag/drop
- adicionar sala
- adicionar mesa
- adicionar estação
- adicionar objeto
- mover elementos
- mudar piso/parede
- definir zones
- salvar
- duplicar cenário

Não é requisito do primeiro milestone.

---

# 44. UI navigation

Manter clean:

- Overview
- Office
- Work
- Observe
- Settings

## Overview

- estado geral
- agentes
- tasks
- saúde
- top consumers

## Office

- agents no escritório pixel
- status
- movimentação
- atenção

## Work

- task DAG
- terminal
- details
- approvals

## Observe

- traces
- usage
- alerts
- evaluation
- replay

## Settings

- agents
- profiles
- models
- tools
- policies
- memory
- scenarios

---

# 45. Prompt Composer

Composer por agent:

- @agent
- @task
- @artifact
- @evidence
- @trace
- @memory
- @decision
- @workspace
- #arquivo

Draft persistente por agent.

---

# 46. Command Palette

Atalho inicial:

Ctrl+P

Localiza:

- agents
- tasks
- workspaces
- files
- artifacts
- traces
- alerts
- commands

---

# 47. Storage

Usar SQLite + WAL.

SQLite:

- agents
- tasks
- events
- traces
- usage
- approvals
- layouts
- scenarios metadata
- memory metadata

Filesystem:

- artifacts
- screenshots
- big logs
- snapshots
- generated reports

Não usar Postgres local no V1.

---

# 48. Security Desktop

Renderer sem acesso direto a Node.

Fluxo:

~~~text
React Renderer
-> Preload Bridge
-> Typed IPC
-> Main/Core
-> OS
~~~

Não expor shell arbitrário no renderer.

---

# 49. Product stack

Inicial:

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
- SQLite + WAL

Observability:
- trace model compatível com OpenTelemetry

Testing:
- node:test ou Vitest
- Playwright para UI

Electron permanece no V1 pela integração direta com Node/node-pty.
Tauri só deve ser considerado depois de medir RAM/CPU real.

---

# 50. Repo structure

~~~text
apps/
  desktop/
  core/

packages/
  contracts/
  agent-system/
  runtime/
  context/
  execution/
  observability/
  evaluation/
  office/

scenarios/
assets/
config/
data/
tests/
docs/
~~~

Dentro do Core:

~~~text
core/
  control-plane/
  api/
  storage/
  event-bus/
~~~

---

# 51. Agent-system structure

~~~text
packages/agent-system/
  schema/
  defaults/
  profiles/
  compiler/
  validators/
  adapters/
    claude.ts
    codex.ts
    gemini.ts
~~~

---

# 52. First milestone

Provar o caminho mínimo:

~~~text
Lumenva Desktop
-> Lumenva Core
-> PTY real
-> Codex real
-> Context Engine
-> Telemetry
-> Agent Node
-> Office Spawn
~~~

Entregar:

1. lumenva-core
2. Electron shell
3. xterm.js + node-pty
4. Codex real
5. SQLite
6. Event Bus
7. MCG/Context conectado
8. telemetry básica
9. Agent Node
10. Office básico
11. agent.created -> spawn automático
12. fechar/reabrir UI sem matar Core

---

# 53. Implementation phases

## Phase A — Foundation

- repo contracts
- Core
- event bus
- SQLite
- typed IPC
- basic desktop

## Phase B — Runtime

- PTY manager
- Claude/Codex/Antigravity adapters
- sessions
- health
- activity

## Phase C — Agent Standard

- schema
- default profile
- profiles
- Agent Architect
- agentctl
- compiler
- validators
- provider renderers

## Phase D — Memory Bridge

- preserve native memory
- bridge files
- Obsidian MCP integration
- Graphify integration
- memory doctor
- pull retrieval policy
- conflict reporting

## Phase E — Context

- MCG integration
- compiler
- cache
- delta
- retrieval

## Phase F — Execution

- tasks
- DAG
- scheduler
- worktrees
- dedup

## Phase G — Control

- capabilities
- risk
- approvals
- budgets
- routing
- lifecycle

## Phase H — Observability

- traces
- usage
- metrics
- alerts
- history

## Phase I — Office

- Canvas/Pixi renderer
- world
- agents
- movement
- pathfinding
- auto-spawn
- scenarios

## Phase J — Evaluation

- replay
- A/B
- graders
- regression
- scores

## Phase K — Product polish

- dashboards
- Office editor
- accessibility
- keyboard navigation
- themes
- performance tuning

---

# 54. Performance rules

Objetivo: manter o sistema leve.

- um único Core process
- evitar microservices
- Office não autoritativo
- Canvas 2D ou PixiJS
- reduzir FPS em background
- pausar render quando invisível
- event-driven em vez de polling
- SQLite local
- lazy load de painéis
- progressive disclosure de memória
- Graphify antes de repo scan
- contexto pull-based

---

# 55. Accessibility

Meta:

WCAG 2.2 AA

Requisitos:

- keyboard navigation
- visible focus
- remappable shortcuts
- screen reader labels
- adequate contrast
- not color-only
- zoom
- terminal font scaling
- reduced motion
- dark/light/system
- IME/CJK
- non-QWERTY layouts

Office deve oferecer alternativa não animada/list view.

---

# 56. Definition of Done

PASS:

funciona end-to-end com evidência real.

PARTIAL:

parte funciona e limitação está documentada.

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

---

# 57. Restrições

- não deploy automático
- não push automático
- não merge automático
- não apagar evidências
- não expor secrets
- não remover controles de segurança
- não substituir memória nativa dos providers
- não usar symlink/junction para forçar memória
- não confundir estimado com exato
- não executar R3/R4 sem aprovação adequada
- não tornar Office a fonte de estado

---

# 58. Migração do Maestri

## M0
MCG atual estabilizado.

## M1
Lumenva Core.

## M2
Desktop shell.

## M3
Bridge temporário para estado existente.

## M4
Agent Runtime próprio.

## M5
Canvas / Office próprio.

## M6
Claude/Codex/Antigravity no Lumenva Runtime.

## M7
Scheduler/DAG/worktrees próprios.

## M8
Control Plane completo.

## M9
Lumenva Link futuro, se necessário.

## M10
Maestri deixa de ser dependência.

---

# 59. Fora do V1

Adiar:

- mobile/iPhone
- remote internet
- multi-host
- portals
- browser embutido
- custom runtimes
- floors avançados
- semantic dedup por embeddings
- causal attribution sofisticada de plugins
- trust score avançado
- office editor completo
- distributed queue

O V1 deve provar:

~~~text
UI
-> Core
-> Agent real
-> Task real
-> Context real
-> Memory real
-> Telemetry real
-> Office projection real
~~~

---

# 60. Princípio final

O sistema deve permanecer simples.

Poucos blocos, contratos claros, estado canônico único.

~~~text
OWNER
  |
  v
LUMENVA CORE
  |
  +-- Control
  +-- Runtime
  +-- Context
  +-- Execution
  +-- Observability
  +-- Evaluation
  |
  v
Canonical State
  |
  +-- Desktop UI
  +-- Pixel Office
~~~

Agents não são o sistema operacional.
O Lumenva Core é.

Memory nativa não é substituída.
Ela é preservada e complementada por um shared layer.

Obsidian guarda conhecimento durável compartilhado.
Graphify representa a estrutura do código.
O Memory Bridge conecta os dois sem quebrar providers.

Novo agent não começa do zero.
Ele herda o Lumenva Agent Default, recebe apenas pequenos overrides, é validado pelo Agent Architect, compilado deterministicamente e nasce automaticamente no Office.

Este documento é a blueprint canônica inicial do Lumenva Command Center V2.
