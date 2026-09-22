
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

## Consolidação validada — Maestri Context & Agent Fabric

Data da validação: 2026-09-22.

Esta seção consolida `implementacao-tokens`, Command Center, Multi-Cloud Agent Fabric e MCP Bus em uma única arquitetura. Ela entra aqui, imediatamente depois da arquitetura alvo, e passa a ser a regra de decomposição dos milestones M1–M9. Não criar uma segunda arquitetura paralela.

### Decisões validadas

1. **Maestri controla o contexto.** Codex, Claude e Gemini recebem `ContextPacket` resolvido pelo Lumenva; não dependemos da semântica de subagents de nenhum provider.
2. **Contexto progressivo.** A sequência padrão é `TaskContract → paths/símbolos → trechos → arquivos adicionais → expansão excepcional`. Nunca fazer dump do repositório ou da sessão inteira por padrão.
3. **Ferramentas lazy.** O agente recebe somente o catálogo filtrado por capability, risco, policy e task; schema detalhado entra sob demanda.
4. **Providers atrás de `ExecutionPort`.** Claude, Codex e Gemini/Antigravity implementam o mesmo contrato e não conhecem a lógica interna do Maestri.
5. **Handoffs passam pelo Maestri.** O fluxo é `HandoffRequest → Context Engine → ContextPacket → executor`; nunca Claude → Codex com sessão integral.
6. **MCP moderno com compatibilidade.** O alvo é MCP `2026-07-28`, usando stateless/sessionless quando cliente e servidor negociarem essa era, cache hints/ordenação determinística em listas, handles explícitos de estado e propagação W3C/OTel. Manter fallback para `2025-11-25` durante a migração; não assumir que todo servidor suporta a era moderna.
7. **Observabilidade uniforme.** Toda execução correlaciona `trace_id`, `job_id`, `task_id`, `agent_id`, `execution_id` e `context_packet_id`.
8. **Qualidade antes de economia.** Benchmarks com baseline medem tokens, cached tokens, tempo, tools expostas, arquivos lidos, custo, sucesso, retries e overflow. Não existe meta arbitrária de redução que possa mascarar regressão.

### Fontes normativas consultadas

- Codex: [Model guidance — AGENTS.md discovery and hierarchical injection](https://developers.openai.com/api/docs/guides/latest-model).
- Claude Code: [CLI reference — MCP configuration, allowed tools and permission modes](https://docs.anthropic.com/en/docs/claude-code/cli-usage).
- Gemini CLI: [CLI commands and hierarchical `GEMINI.md` memory](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md).
- MCP: [2026-07-28 specification](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/docs/specification/2026-07-28), [TypeScript SDK migration](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28) e [OpenTelemetry trace context](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/index.mdx).

Relatos de comunidade entram como sinais de risco e casos de benchmark, nunca como autoridade normativa nem como prova de comportamento de um provider.

### Contratos canônicos

`TaskContract` é o único contrato de entrada:

```text
task_id, goal, scope, allowed_paths, constraints, capabilities,
risk, base_sha, context_budget, tool_budget, execution_budget,
preferred_provider, evidence_required
```

`ContextPacket` é a única unidade de contexto entregue ao executor:

```text
objective, relevant_instructions, relevant_files, relevant_symbols,
prior_decisions, constraints, available_tools, evidence, token_budget
```

`ExecutionPort` expõe `execute`, `resume`, `cancel`, `health`, `capabilities`, `usage` e `quota`.

`ExecutionResult` retorna `task_id`, `status`, `summary`, `files_changed`, `commands`, `tests`, `evidence`, `usage`, `context_used` e `error`.

`ResultDigest` é a saída entre agentes. Logs completos permanecem em Evidence/Trace e não entram automaticamente no próximo prompt.

### Fabric consolidado

```text
TaskContract
    ↓
Context Resolver → Instruction Resolver → Code/Memory Retriever
    ↓
Tool Registry lazy → Token/Tool/Execution Budgeter
    ↓
ContextPacket
    ↓
Resource Router → Policy/Risk/Quota/Latency/Cost
    ↓
ExecutionPort → Claude | Codex | Gemini/Antigravity
    ↓
ExecutionResult → ResultDigest → Maestri
    ↓
Evidence + Telemetry + OTel Trace → Command Center
```

O `MCP Gateway` não será um daemon proprietário com sessões longas. Ele será uma camada de capability registry, policy, cache de catálogos, compatibilidade de versões, handles explícitos, health/capability probing e tracing entre `ExecutionPort` e servidores MCP.

### Capability e disponibilidade real

Inventário verificado no worktree/host:

| Capability | Estado | Evidência / decisão |
|---|---|---|
| Codex CLI | DISPONÍVEL | `codex-cli 0.155.1` |
| Claude Code | DISPONÍVEL | `2.1.278` |
| Gemini CLI | DISPONÍVEL | instalado nesta execução, `0.60.0` |
| MCP TypeScript SDK moderno | DISPONÍVEL | `apps/social-brain-mcp`, `@modelcontextprotocol/server 2.0.0` |
| MCP SDK legado | EXISTENTE | CRM usa `@modelcontextprotocol/sdk 1.30.0`; migrar por adapter, não apagar agora |
| MCG | DISPONÍVEL | `packages/maestri-context-gateway` com registry, router, history, telemetry e validation |
| Electron | AUSENTE | adicionar como dependência do M2 |
| xterm.js/node-pty | AUSENTE | adicionar como dependência do M5 |
| Core/ExecutionPort canônico | AUSENTE | primeiro código novo do M1 |

Ausência de provider, MCP ou capability deve produzir `UNAVAILABLE`/`CAPABILITY_UNAVAILABLE`, nunca stub tratado como sucesso. O router deve provar `health()` e capabilities antes de escolher uma rota.

### Fases do Agent Fabric

Estas fases refinam a ordem de implementação existente:

```text
F0  audit implementation-tokens + fabric atual
F1  TaskContract canônico
F2  ExecutionResult canônico
F3  ContextPacket
F4  Context Budget Engine
F5  Instruction Resolver universal
F6  Progressive Context Retrieval
F7  Tool Registry lazy/on-demand
F8  MCP Gateway 2026 + fallback 2025
F9  ExecutionPort Codex real
F10 ExecutionPort Claude real
F11 ExecutionPort Gemini/Antigravity real
F12 collectors de usage/quota
F13 Resource Router V2
F14 HandoffRequest
F15 ResultDigest
F16 delegação cross-agent via Maestri
F17 integração Memory Retriever
F18 retrieval de conhecimento/código
F19 OpenTelemetry e traces MCP
F20 visualização no Command Center
F21 dashboard de token/context
F22 otimização automática de contexto
F23 testes de integração
F24 benchmarks baseline vs Fabric
F25 rollout e limpeza de compatibilidade
```

### Gates adicionais do plano completo

O fechamento do Fabric exige evidência para:

- nenhum catálogo/tool global desnecessário e nenhum contexto sem hard cap;
- `ContextPacket` reproduzível e expansão sob demanda;
- catálogo MCP cacheado com ordem determinística e probing de capability;
- provider intercambiável sem alterar `TaskContract`;
- Claude → Codex e Codex → Claude somente via Handoff/ResultDigest;
- fallback, quota e usage reais;
- traces atravessando MCP, execução retomável e evidência persistida;
- zero dependência dos stubs antigos;
- benchmark de pelo menos 20 tasks comparando baseline e Fabric sem regressão de qualidade.

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

## Obsidian + Knowledge Graph

Os dois componentes fazem parte do produto, mas não são a mesma coisa:

Esta integração vem do plano separado **AI Platform**, sem CRM:

- `docs/superpowers/plans/2026-08-10-ai-platform-phase-3-knowledge.md` — **Knowledge / Obsidian / LlamaIndex**.
- `docs/superpowers/plans/2026-08-10-ai-platform-phase-4-graphiti.md` — **Graphiti + FalkorDB**.

O nome que estava faltando é **FalkorDB**: banco de grafo open-source/free para o Graphiti. Graphiti é a camada de grafo temporal; FalkorDB é o backend originalmente planejado. A execução anterior registrou uma troca técnica para Neo4j por compatibilidade da imagem oficial do Graphiti. Essa decisão não deve ser perdida nem misturada com o CRM.

Auditoria registrada em `docs/audits/ai-platform-knowledge-graph-command-center-audit-2026-09-22.md`.
Os gates antigos estão fechados no AI Platform, mas a integração standalone começa em `0%`: os contratos e workers precisam ser extraídos do caminho CRM para `packages/` e `apps/core`.

- **Obsidian Vault:** camada humana de conhecimento curado. Guarda decisões, políticas, playbooks, ADRs, notas e documentação operacional em Markdown versionado. O Context Engine consulta notas relevantes sob demanda; nunca injeta o vault inteiro.
- **Graphiti + FalkorDB/Neo4j:** grafo temporal derivado. Representa entidades, relações, episódios, decisões, dependências e proveniência para recuperação contextual e visualização. Não é fonte de verdade e não autoriza mutações no CRM.
- **CRM/Postgres:** fonte canônica dos fatos operacionais, identidade, consentimento, auditoria e estado de negócio.

Pipeline obrigatório:

```text
CRM / docs / commits / eventos
          -> extrator idempotente
          -> facts + edges + provenance
          -> Graphiti/Neo4j
          -> Graph Retriever
          -> ContextPacket
```

Entregáveis específicos:

1. `ObsidianAdapter`: leitura segura, indexação incremental, backlinks/wikilinks, frontmatter, ACL e origem por arquivo/SHA.
2. `KnowledgeGraphPort`: consulta de vizinhança, caminho, dependências, episódios temporais, namespace e provenance.
3. `GraphProjectionWorker`: projeção idempotente de documentos, decisões, commits e eventos; suporta rebuild e invalidação.
4. `Memory/Knowledge Retriever`: combina Obsidian, Graphiti, CRM e RAG sem misturar `project`, `tenant`, `customer` e `agent`.
5. `Graph View` no Command Center: visualização read-only de entidades, relações, jobs, agentes, tools e evidências; cada nó precisa abrir sua fonte.

Regras: Obsidian não vira memória de cliente automaticamente; Graphiti não duplica autoridade do CRM; nenhuma inferência vira regra sem aprovação; toda aresta exibida precisa de source, timestamp, namespace e confidence.

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
  11. Fabric F0–F4: audit, TaskContract, ExecutionResult, ContextPacket e budgets
  12. Fabric F5–F8: Instruction Resolver, progressive retrieval, Tool Registry lazy e MCP Gateway moderno com fallback
  13. M1 Core + contracts + event bus + storage persistente
  14. Fabric F9–F13: ExecutionPorts, usage/quota e Resource Router V2
   15. Fabric F14–F18: handoffs, ResultDigest, delegation e retrieval de Memory/code
   16. Fabric F19–F21: OTel/MCP traces e dashboards de contexto/token
   17. terminal runtime + Electron Desktop shell
   18. Canvas + Agent Nodes + Live Office / Pixel Floor
   19. Portar AI Platform Phase 3: `packages/knowledge` sem dependência de CRM
   20. Portar AI Platform Phase 4: `packages/knowledge-graph` + Graphiti/Neo4j
   21. GraphProjectionWorker + Context Engine retrieval progressivo
   22. Graph View read-only + provenance drill-down
   23. Scene Editor + auto-spawn de agents
   24. budgets + alerts + Lumenva Link
   25. Fabric F22–F25: otimização, integração, benchmark e cleanup de compatibilidade
   26. mobile/remote
   27. refinamento visual e acessibilidade

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

ACTIVE — M0 VALIDATED / KNOWLEDGE + GRAPH STANDALONE IN PROGRESS / M1 NEXT

M0 e a dashboard foram validados no worktree isolado. O próximo gate é F0/F1 + M1 Core, agora sob os contratos canônicos `TaskContract`, `ContextPacket`, `ExecutionPort`, `ExecutionResult` e `ResultDigest`. A pesquisa de providers e MCP foi incorporada nesta fonte de verdade em 2026-09-22.

O port standalone avançou: `packages/knowledge` já valida/exporta notas Obsidian `PUBLISHED` com scanner e provenance; `packages/knowledge-graph` já define namespace determinístico, projection worker, degradação segura, adapter HTTP Graphiti/Neo4j e `GraphView` read-only determinístico; `apps/core` já tem SQLite persistente, migração inicial, tarefas idempotentes, replay, EventBus, health, shutdown, recovery para `RECOVERING`, API loopback em `127.0.0.1`, integração com o `compileContext` real do MCG, telemetria persistida pelo contrato MCG, dashboard consumindo essa telemetria, fluxo completo Knowledge → Graph com eventos `context.requested/completed/failed`, `knowledge.published` e `graph.projected`, `ContextPacket` progressivo determinístico em L0/L1/L2 com instruções priorizadas, hard cap e provenance de versão, Budget Engine multidimensional para tokens, contexto, tools, tempo, custo e quota, passagem do packet para fragments MCG no request real, enforcement de budget antes da execução, Instruction Resolver hierárquico com adaptação por runtime, Tool Registry lazy por capability/domínio com cap, catálogo determinístico e integração no packet, MCP Gateway stateless com cache TTL de `tools/list`/`resources/list`, ordenação determinística, health probing, propagação `traceparent`, handles explícitos com expiração, resolução direta dentro do request do Core, telemetria `mcp.catalog` visível em `by_mcp` na dashboard, spans persistidos pelo trace store MCG, endpoint Core `GET /graph` com validação e resposta sem mutação e dashboard Graph read-only com `/api/graph`, aba de navegação e drill-down de entidades/fontes. Próximo entregável: retrieval real Obsidian/Graphiti no Context Engine e provider Graphiti real no dashboard.

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
