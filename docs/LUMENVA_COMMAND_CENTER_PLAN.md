
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
- Memory OS corporativa com memória compartilhada e memórias privadas por agente
- histórico operacional persistente
- Live Office / Pixel Floor com agentes que nascem automaticamente
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

## Live Office / Pixel Floor

O Command Center terá uma visão opcional de escritório vivo em pixel art.

O Pixel Floor é uma view de observabilidade, não o runtime dos agentes.

Princípios:
- Canvas 2D leve no MVP.
- React controla menus, painéis e modais; não controla frame a frame os personagens.
- Office Engine recebe eventos reais do Core.
- movimento visual representa estado real sempre que possível.
- fechar ou ocultar o Pixel Floor nunca interrompe agents.

Entidades:
- World
- Room
- Zone
- Desk
- Station
- Decoration
- AgentAvatar
- SpawnPoint
- Portal
- InteractionPoint

Estados visuais:
- IDLE
- WALKING
- THINKING
- READING
- CODING
- TOOL_USE
- REVIEWING
- WAITING
- NEEDS_APPROVAL
- BLOCKED
- FAILED
- DONE
- OFFLINE
- SYNCING
- DELEGATING

## Nascimento automático de agents

Ao criar um agent no Agent Registry:

agent.created
-> Office Engine
-> Spawn Manager
-> resolve role/tags
-> resolve room
-> resolve desk/station
-> cria avatar
-> aparece no escritório
-> move para seu posto

Prioridade de spawn:
1. role compatível
2. tags/capabilities
3. desk/station disponível
4. spawn zone padrão

O agent nasce visualmente sem exigir configuração manual adicional.

## Scene / Scenario System

Cenários não ficam hardcoded na UI.

Um cenário define:
- tamanho do mapa
- rooms
- zones
- walls
- floors
- spawn zones
- desks
- stations
- decorations
- collision map
- interaction points

Criar Scene Editor visual com:
- drag and drop
- adicionar/remover sala
- adicionar/mover mesa
- adicionar estação
- adicionar decoração
- mudar piso/parede
- criar zonas
- salvar
- duplicar
- versionar cenário

Assets modulares:
- characters/
- furniture/
- decorations/
- rooms/
- effects/
- themes/
- scenarios/

Exemplos de estações semânticas:
- Git Station
- QA Lab
- Research Station
- MCP Hub
- Memory Vault
- Context Core
- Approval Gate
- Deployment Room

O visual nunca pode inventar atividade. Se não houver telemetria suficiente, mostrar estado genérico/indisponível em vez de fingir comportamento.

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

## Memory OS corporativa

A memória não pode ser um único bucket global nem um preload permanente de tudo.

A memória compartilhada da empresa contém apenas verdades comuns e validadas:
- decisões aprovadas
- arquitetura aprovada
- objetivos
- políticas
- estado operacional
- jobs importantes
- evidências
- fatos organizacionais canônicos

Memórias operacionais permanecem separadas por domínio/agente.

Namespaces iniciais:
- company/
- executive/claude/
- engineering/codex/
- intelligence/antigravity/
- episodic/jobs/
- projects/
- customers/ quando houver contexto Customer Ops

Regras:
- Claude CEO não grava diretamente memória privada do Codex.
- Codex não grava diretamente memória executiva.
- Antigravity não promove pesquisa para verdade corporativa sem validação.
- Memória episódica de job não vira automaticamente memória corporativa.
- Toda promoção de memória precisa preservar source, provenance, timestamp, confidence derivada de evidência e histórico de supersession.

Pipeline de promoção:

experiência
-> conhecimento candidato
-> validação
-> conhecimento aprovado
-> memória corporativa

Nenhuma memória candidata pode virar verdade da empresa apenas porque um modelo afirmou algo.

## Ownership e fontes de verdade da memória

Cada classe de informação deve ter owner explícito.

Fonte canônica:
- Postgres / CRM: fatos operacionais e de negócio.
- org_memory: conhecimento corporativo aprovado.
- customer_memory: memória omnichannel de cliente, quando aplicável.
- agent_memory: memória privada/especializada de cada agente.
- episodic/jobs: contexto e aprendizado de execuções específicas.

Projeções derivadas:
- Graphiti: relações e temporalidade derivadas dos fatos canônicos.
- Mem0: memória semântica opcional e descartável/reconstruível.
- pgvector / RAG: conhecimento publicado e recuperável.
- Obsidian ou equivalente: conhecimento humano curado e consultado sob demanda.
- Skills: procedimentos versionados.
- Hooks / Policies: comportamento determinístico, nunca memória probabilística.

Graphiti, Mem0 e índices vetoriais não substituem a fonte canônica.

## Retrieval e economia de contexto

O sistema nunca deve pré-carregar todo o vault ou toda a memória de um projeto.

O Context Engine compila contexto sob demanda por job.

Estratégia inicial:
- janela recente curta
- resumo da sessão
- L0/L1 sempre quando relevantes
- recuperação top-k pequena de memória relevante
- decisões/constraints/must_keep com prioridade máxima
- evidência vinculada à task
- project memory apenas quando necessária

Default inicial de retrieval:
- 1 a 5 itens realmente relevantes por classe, ajustável pelo Context Compiler.

Cada retrieval registra:
- memory_id
- namespace
- source
- provenance
- score/reason
- timestamp
- bytes/chars/tokens
- cache hit/miss
- task_id
- trace_id

## Ciclo de vida e higiene da memória

Todo item de memória deve suportar:
- created_at
- updated_at
- last_used_at
- source
- provenance
- owner
- scope
- status
- supersedes
- superseded_by
- ttl quando aplicável
- retention policy
- sensitivity
- hash/version

Estados possíveis:
- CANDIDATE
- VALIDATED
- ACTIVE
- STALE
- SUPERSEDED
- REJECTED
- ARCHIVED

Memórias antigas não devem ser apagadas silenciosamente quando forem evidência histórica; devem poder ser superseded/archived.

## Handoffs e memória de engenharia

Handoffs de Claude/Codex/Antigravity são memória operacional, não verdade corporativa automática.

Um handoff deve registrar:
- objetivo
- estado atual
- arquivos tocados
- decisões
- evidências
- testes
- blockers
- próximos passos
- trace/task IDs

O próximo agente recebe somente o handoff + memória recuperada necessária ao trabalho.

## Histórico operacional separado de Memory OS

Logs, métricas, traces, cache e eventos operacionais não são a mesma coisa que memória semântica.

Criar HistoryStore atrás de uma interface própria para:
- tasks
- traces
- token_usage
- context_metrics
- cache_metrics
- alerts
- eval_runs
- replays
- agent_usage
- tool_usage
- plugin_usage
- mcp_usage
- runtime health

Política inicial:
- raw append-only
- rollups diários
- queries Today / 7d / 30d / All time
- retenção configurável
- export/backup sem colocar secrets no Git

O Git contém código/configuração segura; não é o banco dos logs nem da memória operacional.

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

## M0 — Remediação obrigatória antes do Command Center

Nenhuma feature nova do Command Center deve ser construída antes de fechar M0.

### M0.0 Auditoria de caminhos do ambiente Windows

Antes de qualquer migração ou correção de configuração pessoal:

- comparar o perfil Windows e as raízes usadas pelos apps/CLIs;
- inventariar caminhos globais e por workspace de Codex/ChatGPT, Claude Code, Gemini CLI e Antigravity para config, skills, plugins, hooks, MCP, cache/runtime e estado de autenticação, sem ler valores de credenciais;
- distinguir app, runtime empacotado, CLI independente, cache e configuração do usuário;
- conferir caminhos com documentação oficial e registrar divergências;
- não mover, sobrescrever, apagar, reinstalar ou editar configurações globais nesta etapa.

Evidência: `docs/superpowers/audits/2026-09-22-windows-agent-profile-path-audit.md`.

Estado: **AUDIT PASS / NO CONFIG CHANGES**. O perfil e os diretórios padrão observados são consistentes. A entrada `CODEX_HOME` dentro do `config.toml` não foi comprovada como causa de erro e não foi alterada. A auditoria não prova que o erro do app foi corrigido; qualquer migração segue bloqueada até diagnóstico específico, backup e autorização.

### M0.1 Preservação

Branch de recuperação já criada:
- backup/lumenva-command-center-pre-cleanup-2026-09-22

Estado antigo protegido:
- HEAD contaminado conhecido: 34c6b398520f5a46a98edf0e1d74ad500cd104fb
- commit contaminado: 437a0f532cb392e067f18a8011c58424c6265b6c
- último commit limpo conhecido do plano: ed148778a4591a8aaf0e1b1efd5c90007f00cfd6

Não apagar a branch de backup até o fechamento completo da remediação.

### M0.2 Reconstrução limpa da branch

Criar branch temporária de repair partindo de ed148778a4591a8aaf0e1b1efd5c90007f00cfd6.

Transportar somente:
- docs/LUMENVA_COMMAND_CENTER_PLAN.md
- docs/superpowers/plans/2026-09-22-lumenva-context-gateway.md
- docs/superpowers/specs/2026-09-22-lumenva-context-gateway-design.md
- packages/maestri-context-gateway/**

Allowlist inicial da reconstrução:
- docs/LUMENVA_COMMAND_CENTER_PLAN.md
- docs/superpowers/**
- packages/maestri-context-gateway/**

Não trazer como parte da remediação MCG:
- apps/crm/**
- apps/social-brain/**
- packages/social-brain/**
- packages/integrations/meta/**
- supabase/**
- mudanças não relacionadas ao MCG/Command Center

Antes de mover lumenva-command-center para a história limpa:
- comparar branch repair vs main
- comparar MCG repair vs backup
- provar que nenhum arquivo MCG foi perdido
- provar que nenhuma mudança lateral entrou

A reescrita de lumenva-command-center está autorizada somente depois desses gates.
A main não deve ser alterada.

Estado da comparação (2026-09-23): reconstrução local baseada em `ed148778a4591a8aaf0e1b1efd5c90007f00cfd6`; o delta desde o merge-base de `origin/main` contém apenas plan/docs/superpowers/MCG e o lockfile necessário. Nenhum arquivo MCG foi removido em relação ao backup. O remoto `lumenva-command-center` avançou com runtime/workflows laterais; a branch de reconstrução não foi publicada, pois isso apagaria arquivos no diff. A integração MCG foi feita em branch separada baseada no remoto atual (`codex/mcg-ci-integration`), preservando os laterais; PR draft #26 aponta somente para `lumenva-command-center`. Nenhuma reescrita ou alteração em `main` foi feita; sem merge.

### M0.3 Integração correta com monorepo e CI

Corrigir package scripts do MCG para participar dos gates do monorepo.

Adicionar test:unit equivalente ao test atual.

Atualizar pnpm-lock.yaml de forma consistente.

Criar CI específico para MCG em lumenva-command-center e em PRs que toquem:
- packages/maestri-context-gateway/**
- docs relevantes do MCG

Gates:
- install frozen
- tests MCG
- import/syntax smoke
- secret scan
- path/personal-data scan
- dashboard smoke
- contracts smoke

Nenhum commit do MCG pode ser considerado PASS sem testes automáticos.

Falha remota observada: run `35687560851` (MCG gates) parou em `pnpm install --frozen-lockfile` porque o lockfile remoto não tinha os specifiers de `packages/lumenva-core/package.json` (`@types/node` e `typescript`). Isto é um gate de lockfile do monorepo, não um erro de teste do MCG; atualizar o lockfile contra o workspace atual e repetir todos os gates.

Estado local (2026-09-23): lockfile atualizado de forma consistente; frozen install PASS; os cinco gates MCG (34 testes unitários, sintaxe/import, secret/path scan, dashboard e contracts) PASS; `git diff --check` PASS. A alteração do lockfile também aciona `.github/workflows/lumenva-core.yml`: `typecheck` falha em erros existentes nos testes (imports `.ts`, callback types e `EventBus.subscribe`), e `test:unit` falha em resolução de `src/contracts.js` sob `node --experimental-strip-types`. Não alterar `packages/lumenva-core/**` nem enfraquecer seu workflow dentro desta allowlist. Evidência remota mais recente no PR draft #26 (`codex/mcg-ci-integration` → `lumenva-command-center`, sem merge), commit `7f2d23c9`: MCG run `35805179393` PASS; vertical `35805179433` PASS; invariants job PASS; core run `35805179418` FAIL e verify no CI `35805179410` FAIL pelo typecheck de `lumenva-core`. A PR permanece aberta para validação, sem tocar `main`. M0.3 permanece aberto até CI obrigatória passar. Uma remediação dos erros do core exige escopo separado.

### M0.4 Correções conhecidas de métricas

Corrigir bug visual de REDUÇÃO %, evitando dupla formatação number -> string -> number.

Corrigir cache accounting:
- hits são calculados antes de inserir misses
- tokens_avoided considera somente fragments que já eram hits
- misses da execução atual não entram como saving

Compression Ratio:
- usar soma ponderada de original vs delivered
- não média simples por evento

MCG Coverage:
- medir por tasks/traces/turns elegíveis
- não por context.compile events / total telemetry events

Separar:
- Estimated Context Savings
- Compression
- Coverage
- Real Workflow Token Savings

Nunca apresentar bytes/4 como economia real do workflow.

### M0.5 Trust, Efficiency e Regression

Remover dataset_size hardcoded em 1.

Criar agregador real de paired evals.

Estados mínimos:
- 0–29 pares válidos: VALIDATING
- >=30 + quality gates: VALIDATED
- dados insuficientes: UNVALIDATED

Efficiency não pode virar MEASURED com dataset insuficiente.

Regression Watch:
- regressão comprovada -> REGRESSION_DETECTED
- dados suficientes sem regressão -> NO_REGRESSION
- dados insuficientes -> UNVALIDATED

### M0.6 Executor robusto para Eval e Replay

Criar executor comum com:
- spawn
- stdout/stderr
- heartbeat
- last_activity_at
- timeout configurável
- cancellation
- graceful kill
- hard kill
- exit classification

Remover timeout único rígido de 45s para todos os replays.

Eval Runner não pode esperar indefinidamente.

Classes iniciais:
- TINY
- LIGHT
- NORMAL
- HEAVY

Timeout e policy devem ser configuráveis.

### M0.7 HistoryStore

O código deve preservar o princípio:
Git não é o banco de runtime.

Criar HistoryStore com interface própria.

Persistir:
- telemetry
- traces
- evals
- replay
- alerts
- cache metrics
- usage
- task history

Suportar:
- Today
- 7d
- 30d
- All time

Manter provenance e measurement_type.

### M0.8 Contracts e registries

Os JSON Schemas devem ser usados por validação real, não apenas existir como arquivos.

Validar contratos:
- task
- event
- trace
- telemetry
- agent
- runtime
- tool
- plugin
- mcp
- alert
- eval
- artifact

Registries não podem permanecer [] como estado final.

Popular dinamicamente/por descoberta real:
- agents
- tools
- plugins
- MCPs
- runtimes
- models

Cada registro:
- id/name
- version
- capabilities
- health
- last_seen
- success_rate
- failure_rate
- latency
- usage
- measurement_type
- source

Progresso verificável (2026-09-23): os 12 tipos de contrato têm validação em runtime nos caminhos correspondentes: entradas e histórico de task, eventos recebidos e publicados, traces/spans, telemetry, registries, alerts, evals e artifacts/evidence. `saveEvaluation` valida antes de persistir; `measurement_type` só é `exact` quando ambas as metades baseline/MCG são exatas. Regressões confirmaram rejeição de timestamp inválido em event, trace sem `trace_id`, alert incompatível e measurement fabricada, além de par com medição parcial classificado como `unavailable`. Testes locais da suíte, dashboard, contracts, sintaxe e scan passaram. A validação de contratos não comprova, sozinha, que registries reais foram descobertos/populados; isso continua separado no M0.8.

### M0.9 Scheduler, Router e Reliability

Transformar primitives isoladas em fluxo operacional:

Task
-> DAG
-> Ready Queue
-> Router
-> Risk
-> Capability Check
-> Approval
-> Executor
-> Verification

Adicionar:
- queue
- leases
- dependency wakeup
- concurrency limits
- resource locking
- cancellation
- retry history
- Dead Letter Queue
- semantic dedup
- worktree allocation

Circuit Breaker deve persistir estado entre reinícios.

Progresso verificável (2026-09-23): `PersistentScheduler.runOnce` executa nodes READY independentes em paralelo até `concurrency_limit`, preservando route/resource leases e aguardando a verificação de cada resultado. O `PersistentCircuitBreaker` agora participa do roteamento: falhas do executor são persistidas e provedores com circuito aberto são removidos das rotas, inclusive após recriar o scheduler. Testes reproduziram RED→GREEN para concorrência (`maxActive=1` → `2`) e breaker (`CLOSED` após três falhas → `CIRCUIT_OPEN`; sem novo dispatch após restart). Suíte MCG 34/34 PASS, syntax 30 módulos PASS e scan PASS. Restante dos requisitos M0.9 continua sujeito à validação operacional completa; estes testes não fecham o gate inteiro.

### M0.10 Evidence, Progress e Confidence

Separar:
- Progress
- Evidence Coverage
- Confidence

Progress = acceptance criteria concluídos.

Evidence Coverage = critérios sustentados por evidência.

Confidence = derivada de tests, typecheck, evidence, verifier e unresolved issues.

Nunca usar Confidence = Progress.

Evidence Graph completo:
Claim -> Evidence -> Source -> Artifact -> Task -> Trace

### M0.11 Validation Lab completo

Primeiro:
- deterministic/unit tests
- 6 paired smoke runs

Depois dos smoke gates:
- mínimo 30 paired evaluations reais

Distribuição inicial:
- 5 context recall
- 5 coding
- 5 tool-heavy
- 5 long-context
- 5 evidence/review
- 5 mixed workflow

Cada par mantém:
- mesma task
- mesmo model
- mesmo effort
- mesmo workspace snapshot
- mesmas tools
- mesma policy

Somente depois calcular como validated:
- real workflow savings
- Trust
- Efficiency
- Regression baseline

Estado real observado (2026-09-23): o runtime global contém 2 registros pareados históricos, ambos sem categoria; o agregador agora os rejeita como inelegíveis, portanto há 0 pares elegíveis. O dataset `validation.jsonl` contém os 30 casos previstos (5 por cada uma das 6 categorias), mas ainda não foram executados como avaliações reais. Executar o dataset exigirá chamadas reais do Codex e poderá consumir quota; não sintetizar esses dados nem marcar Trust/Regression como validated antes dos resultados reais.

### M0.12 Dashboard e história

Dashboard deve responder:
1. O que está acontecendo?
2. O que está custando?
3. O MCG está realmente ajudando?

Views mínimas:
- Overview
- History
- Traces
- Tasks
- Agents
- Tools
- Plugins
- MCPs
- Cache
- Memory
- Validation
- Alerts

Nenhuma view final aceita:
- NaN
- fake zero
- unknown inventado
- []
- placeholder
- future/prepared como PASS

Verificação local do dashboard real (2026-09-23, somente GET via PowerShell; sem navegador): dashboard respondeu em loopback; `/api/health` confirmou wire `ONLINE` e workspace online. `/api/tasks` mostrou 15 registros; `/api/stats`, 7 concluídas e 6 ativas. Métricas MCG estão `unavailable`, Trust `UNVALIDATED` e dataset real tem 0 pares elegíveis. Descoberta observada: 3 agents, 3 runtimes, 1 tool; plugins e MCPs sem eventos reais, portanto vazios/`unavailable`. O dashboard está servindo dados atuais corretamente, mas ainda não demonstra economia de tokens nem avaliação positiva; não preencher essas lacunas com mocks.

### M0.13 Gate de conclusão

M0 fecha somente quando:

- branch hygiene PASS
- unrelated files 0
- secrets 0
- MCG tests PASS
- MCG CI PASS
- cache accounting PASS
- metrics semantics PASS
- contracts PASS
- registries reais
- history persistente
- scheduler/router/reliability operacionais
- progress/confidence separados
- 30 paired evals válidos
- Trust/Regression com dataset suficiente
- dashboard sem fake metrics
- PARTIAL final = 0
- NOT_STARTED final = 0
- BLOCKED apenas quando externo, reproduzível e documentado

## Migração gradual a partir do Maestri

M0: Remediação, Memory OS e MCG estabilizados.
M1: Criar Lumenva Core.
M2: Criar Desktop shell.
M3: Ler estado existente via bridge.
M4: Canvas, Agent Nodes e Pixel Floor próprios.
M5: Terminal próprio xterm.js + node-pty.
M6: Claude/Codex/Antigravity rodando no Lumenva Runtime.
M7: Scheduler, DAG, Worktrees e Memory OS integrados ao Core.
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

## Restrições e autorização de execução

- Não fazer deploy em produção automaticamente.
- Não fazer merge em main automaticamente.
- Push e reescrita controlada de lumenva-command-center estão autorizados para executar este plano, desde que o backup e os gates de comparação estejam comprovados.
- Não apagar a branch de backup até a conclusão final.
- Não apagar evidências.
- Não executar mutações de produção, delete destrutivo ou manipulação de secrets sem Owner approval explícito.
- Não expor secrets.
- Não remover controles de segurança do sistema operacional/runtime.
- Não confundir estimativa com dado exato.
- Não usar subagents para a implementação deste plano quando a execução tiver sido solicitada inline.
- Em caso de dúvida técnica, consultar primeiro documentação oficial da tecnologia envolvida e registrar a decisão/evidência.

## Ordem de implementação

0. Backup + reconstrução limpa da branch
1. CI/monorepo + correções conhecidas do MCG
2. Metrics semantics + cache accounting
3. Trust/Efficiency/Regression + executor robusto
4. HistoryStore + Memory OS completa
5. Contracts + registries
6. Scheduler + DAG + router + reliability + worktrees
7. Evidence + artifacts + progress/confidence + CEO brief
8. Validation Lab: 6 paired smoke
9. Validation Lab: 30 paired evaluations
10. Dashboard/History/Trace final do MCG
11. Core + contracts + event bus
12. terminal runtime
13. agent runtime
14. MCG/context engine nativo
15. storage + telemetry + traces no Core
16. Canvas + Agent Nodes + Live Office / Pixel Floor
17. Scene Editor + auto-spawn de agents
18. budgets + alerts
19. Lumenva Link
20. mobile/remote
21. refinamento visual e acessibilidade

## Regra de execução contínua

Quando este plano for colocado em execução integral:
- executar inline, sem subagents;
- não parar após implementar apenas um subconjunto;
- auditar antes de modificar;
- manter checkpoints verificáveis;
- rodar testes após cada milestone;
- corrigir regressões antes de avançar;
- consultar documentação oficial diante de dúvida de API, runtime, Git, Electron, Node, PTY, SQLite, GitHub Actions ou qualquer dependência;
- continuar automaticamente enquanto houver trabalho executável dentro do escopo e permissões disponíveis;
- parar somente diante de bloqueio externo real, irreversível ou que exija credencial/Owner action não disponível;
- quando bloqueado, registrar exatamente: BLOCKER, causa, evidência, impacto e ação mínima do Owner.

## Definition of Done global

O projeto não termina porque código foi escrito.

Só termina quando:
- cada milestone tem evidência;
- testes relevantes passam;
- nenhum PASS depende de mock/placeholder;
- métricas exibidas possuem provenance;
- Memory OS respeita ownership e promotion;
- runtime e UI refletem estado real;
- branch está limpa;
- CI está verde;
- documentação foi atualizada;
- PARTIAL final = 0;
- NOT_STARTED final = 0;
- BLOCKED restante é exclusivamente externo e documentado.

## Status atual

ACTIVE — M0 REMEDIATION INCOMPLETE / M0.3 BLOCKED BY EXISTING CORE GATES / M0.13 OPEN / M1 BLOCKED ON M0 CLOSE

O dashboard possui evidência local e remota MCG: unit 34/34, sintaxe 30 módulos, scan, dashboard 12/12, contracts 1/1 e Actions MCG PASS no PR draft #26. `saveEvaluation` valida o contrato e não promove medições incompletas a `exact`; scheduler tem testes para concorrência limitada e circuit breaker persistente. O runtime tem 0 pares elegíveis; há dataset estático com 30 casos equilibrados, ainda sem execução real. No commit `ea3d122a`, `core` e `verify` falharam em erros de typecheck em `packages/lumenva-core`, fora da allowlist MCG; `invariants` e `vertical` passaram. Não alterar esse pacote nem enfraquecer seus gates dentro da remediação MCG. M0.3 e M0.11 permanecem abertos; M0.13 continua aberto até todos os gates serem comprovados. Não iniciar M1 antes de fechar M0.

Este documento é a fonte de verdade única da branch Lumenva Command Center.
Não criar um segundo plano concorrente para o mesmo escopo; atualizar este arquivo.


## Execution Handoff — implementação integral

Este arquivo é a única fonte de verdade para a execução do Lumenva Command Center nesta branch.

Ao iniciar uma nova sessão de implementação:

- ler este documento inteiro antes de modificar código;
- executar o plano na ordem definida, começando pelo primeiro gate incompleto;
- trabalhar inline na sessão principal, sem subagents;
- usar autonomia máxima dentro do workspace/branch e das permissões já concedidas;
- não pedir confirmação para operações normais e reversíveis necessárias ao plano;
- preservar o backup `backup/lumenva-command-center-pre-cleanup-2026-09-22`;
- nunca alterar `main` como parte desta execução;
- manter a Memory OS, memória L0–L5, namespaces, provenance, promotion pipeline, retrieval sob demanda, handoffs e HistoryStore como partes obrigatórias do produto;
- não confundir Memory OS com logs, telemetry, cache ou histórico operacional;
- consultar documentação oficial quando houver dúvida de comportamento/API antes de improvisar uma solução;
- testar cada milestone e corrigir regressões antes de avançar;
- registrar evidência verificável para cada PASS;
- não encerrar por limite artificial de milestone: continuar para o próximo item executável;
- somente interromper por bloqueio externo real, credencial/Owner action necessária, conflito irreversível, indisponibilidade externa que impeça avanço ou risco fora das autorizações deste documento;
- em bloqueio, emitir `BLOCKED_OWNER` ou `BLOCKED_EXTERNAL` com causa, evidência, impacto e ação mínima necessária;
- não desabilitar controles de segurança do sistema operacional/runtime, não expor secrets e não executar mutações destrutivas/produção sem a aprovação exigida neste plano.

O fechamento integral exige:

```text
M0 remediation complete
+
Memory OS complete
+
MCG V4 complete
+
Core/Runtime complete
+
Desktop/Canvas/Pixel Floor complete
+
Validation complete
+
CI green
+
PARTIAL = 0
+
NOT_STARTED = 0
+
remaining BLOCKED only if externally proven
```

Se uma implementação anterior já existir, auditar e reutilizar o que estiver correto. Não recomeçar do zero sem necessidade e não marcar como PASS apenas porque há arquivos, endpoints, mocks ou testes isolados.
