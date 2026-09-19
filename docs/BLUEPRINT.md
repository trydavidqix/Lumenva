# AGENTIC ENGINEERING OS - MASTER IMPLEMENTATION BLUEPRINT

Status: definitivo; aprovado pelo Dono em 2026-09-16. Implementação continua não autorizada sem novo gate.

Este é o `BLUEPRINT.md` canônico da hierarquia de notas. O documento histórico `AGENTIC ENGINEERING OS - MASTER IMPLEMENTATION BLUEPRINT.md` permanece como fonte de pesquisa/origem; mudanças futuras devem ocorrer primeiro neste arquivo e ser reconciliadas com as demais notas.

Data da fotografia: 2026-09-16  
Escopo: sistema de engenharia para User → Maestri → orquestração → execução Codex → verificação → revisão independente → retry/escalation → gate humano.

## Decisão executiva

### Escopo aprovado para implementação atual

V0–V3 somente: baseline, state/event kernel simples em Markdown, Loop Controller,
Git worktree, Builder, verifier determinístico e Reviewer independente. Manter
contratos de retorno, estados padronizados, stop condition para premissa errada
e retry limitado.

Adiados: sandbox/container, matriz R0–R4, evidence manifest, hash de diff,
Postgres/event log, idempotência/checkpoint formal, offline queue, resume após
desconexão e V4–V8. Permanecem como desenho futuro, não como implementação atual.

A arquitetura fornecida está correta como intenção de governança, mas incompleta como sistema confiável. A recomendação é mantê-la como modelo operacional e trocar três fundamentos:

- `MISSION.md`, `TASKS.md` e `RUNLOG.md` deixam de ser a fonte primária. A fonte primária passa a ser estado estruturado transacional + event log append-only; os Markdown continuam como projeções humanas e handoffs.
- Maestri continua sendo o control plane visual e de transporte, mas não deve ser a autoridade de estado nem o único mecanismo de observabilidade. O runtime precisa sobreviver a crash, desconexão do canvas ou troca de terminal.
- O ciclo Builder → verifier determinístico → Reviewer é mantido, porém com contratos formais, snapshots de entrada, evidência por comando, hash do diff, isolamento físico e verificador fresco. O Reviewer nunca corrige nem promove a própria alteração.

O desenho final é um sistema híbrido: Postgres/event log para verdade e recuperação; filesystem/git para artefatos e mudanças; worktree/floor/sandbox para isolamento; Maestri para coordenação observável; Claude Maestro para planejamento e decisão; Codex para execução; verificadores determinísticos e Reviewer independente para aceitação.

## A. Research Findings

### Método e limite

Foi feita auditoria read-only do workspace, dos worktrees e da documentação existente, seguida de pesquisa externa via Agent Reach (Exa, GitHub CLI, Jina/links oficiais e consulta de Maestri) e via The Last 30. A janela do The Last 30 foi 2026-08-17 a 2026-09-16.

O The Last 30 retornou 74 itens em GitHub, Hacker News, Instagram, Pinterest, Reddit, Threads e TikTok. Reddit ficou parcial por HTTP 429; X e YouTube não produziram cobertura utilizável nesta execução. Portanto, sinais de comunidade são direcionais, não uma medição completa do ecossistema.

### Evidências convergentes

1. **O harness é o produto de confiabilidade.** A pesquisa da Anthropic descreve eval harness como a infraestrutura que executa tarefas, isola ambientes, grava passos e agrega graders; a mesma pesquisa separa agent harness de modelo. O sistema deve avaliar o conjunto modelo + harness, não apenas a resposta final.

2. **O orquestrador deve preservar ownership claro.** A documentação oficial da OpenAI distingue `handoffs` — o especialista assume a conversa — de “agents as tools” — o manager continua dono do resultado. Para engenharia de código, o segundo padrão é melhor: Maestro/Claude mantém o controle e chama Builder, Verifier e Reviewer com contratos estreitos.

3. **Começar com poucos agentes é uma regra de economia e legibilidade.** A OpenAI recomenda adicionar especialistas somente quando houver ganho real de isolamento de capacidade, política, clareza de prompt ou legibilidade de trace. Multiplicar agentes sem fronteira de responsabilidade cria custo, traces e superfícies de aprovação desnecessários.

4. **Sessão, harness e sandbox devem ser separáveis.** A arquitetura recente de Managed Agents da Anthropic separa “brain”, “hands” e “session”: o log durável fica fora do harness, o sandbox pode morrer e ser reprovisionado, e o harness pode acordar de um `sessionId`. Isso confirma a decisão de não fazer Maestri, terminal e filesystem serem a única fonte de verdade.

5. **Contexto deve ser recuperável, não apenas resumido.** A Anthropic descreve contexto como objeto consultável sobre um event log, com slices posicionais, re-leitura de eventos e transformação antes do envio ao modelo. Compaction é útil, mas não deve destruir a evidência original. O Context Engine precisa emitir um “context packet” mínimo com ponte para artefatos e eventos.

6. **Ferramentas e resultados são o principal imposto de contexto.** A pesquisa da Anthropic sobre MCP mostra que carregar centenas de tool definitions e resultados intermediários infla custo e latência; descoberta sob demanda e filtragem no ambiente podem reduzir drasticamente o contexto. A regra proposta é tool registry por capability, schema resumido primeiro e detalhes sob demanda.

7. **Guardrails não substituem aprovação humana.** A documentação oficial da OpenAI separa validação automática de human review: guardrails checam input/output/tool, enquanto aprovação pausa a execução e retoma o mesmo estado persistido. Aprovação precisa ser um estado durável, não uma request HTTP aberta.

8. **Trace antes de eval, eval antes de otimização.** A OpenAI recomenda usar traces para descobrir falhas reais e depois datasets/graders para medir regressão. A observabilidade proposta registra trace de run, model call, tool call, handoff, policy, approval e side effect, com prompts/resultados sensíveis redigidos por default.

9. **A comunidade está convergindo para harnesses de coding agent, não para “prompts mágicos”.** Nos resultados dos últimos 30 dias apareceram implementações como DeepCode, OpenHarness, `oh-my-claudecode`, `grok-build`, `deepagents` e repositórios de observabilidade como Langfuse. O padrão comum é loop explícito, skills, memory, isolamento e instrumentação; popularidade não é prova de segurança, por isso esses projetos são referências de padrões, não dependências obrigatórias.

10. **O sinal comunitário também expõe o risco.** Um item de TikTok sobre harness resumiu o problema como guias, loop, sensores, memória, permissões e observabilidade; outro tratou a “chaos” do multi-agent como normal quando papéis e conexões são ambíguos. Isso reforça fronteiras de arquivo, schemas de saída, orçamento e stop conditions como requisitos, não documentação opcional.

### Fontes externas principais

- [OpenAI — Agents SDK](https://developers.openai.com/api/docs/guides/agents/sdk)
- [OpenAI — Multi-agent](https://developers.openai.com/api/docs/guides/agents-api/multi-agent)
- [OpenAI — Orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration)
- [OpenAI — Guardrails and human review](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals)
- [OpenAI — Integrations and observability](https://developers.openai.com/api/docs/guides/agents/integrations-observability)
- [OpenAI — Evaluate agent workflows](https://developers.openai.com/api/docs/guides/agent-evals)
- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Anthropic — Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [Anthropic — Scaling Managed Agents](https://www.anthropic.com/engineering/managed-agents)
- [Anthropic — Context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Claude managed agents — multi-agent orchestration](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration)
- [Maestri — canvas e orchestration](https://www.themaestri.app/en)
- [Open Maestri — implementação comunitária e CLI compatível](https://github.com/zlh-428/open-maestri)
- [Agent Reach](https://github.com/Panniantong/Agent-Reach)
- [The Last 30](https://github.com/mvanhorn/last30days-skill)
- GitHub signals consultados: [DeepCode](https://github.com/HKUDS/DeepCode), [OpenHarness](https://github.com/HKUDS/OpenHarness), [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode), [deepagents](https://github.com/langchain-ai/deepagents), [Langfuse](https://github.com/langfuse/langfuse), [IBM AssetOpsBench](https://github.com/IBM/AssetOpsBench).
- Evidência local completa do The Last 30: `/private/tmp/last30days-crm/agentic-ai-multi-agent-orchestration-loop-engineering-agent-harness-verification-raw-crm-blueprint.md`.

## Auditoria do workspace antes do desenho

O diretório `/Users/david/Desktop/CRM` não é um checkout Git único; contém múltiplos worktrees, `.maestri`, arquivo `error.log`, arquivo morto e worktrees por etapa. A branch mais relevante para esta decisão é `.worktree-arch-ceo-mcg-2026-09-16`, com branch `arch/ceo-codex-mcg-2026-09-16`, 11 commits à frente de `origin/main` e `docs/Current-State.md` modificado. Isso significa que qualquer implementação futura deve escolher explicitamente o checkout-alvo; não se deve editar a raiz por engano.

Há implementação substancial já existente:

- `lib/agent-engine` é o runtime canônico; não deve nascer um segundo engine.
- `AgentKernel.run()` e `createAgentKernelComposition()` já definem composição de resolução, contexto, runtime, loop, política, checkpoint, verificação e evidência.
- `event_log`, `job_queue`, workers, Supabase/Postgres, MCP, skills, memory e observabilidade já aparecem como contratos do Agent OS.
- `loop/LOOP.md`, `RUN.md`, `CHECKPOINT.md`, hooks, `plan/features.json`, `plan/progress.md` e `docs/runbooks/agent-harness.md` já implementam parte da governança maker≠checker.
- Há `docs/architecture/agent-os/`, specs, fixtures, migrations de harness/memory/approvals e testes de invariantes.
- O estado documentado ainda registra lacunas: GitHub Actions desabilitado; `gov:verify` não inclui `test:db` nem E2E; benchmark comparativo da Fase 7 incompleto; Fase 5 com verificação pendente; worktrees e docs históricos coexistem.
- Maestri é tratado localmente como transporte/control plane, mas o próprio documento local registra que o CLI instalado não expõe event feed/WebSocket documentado. A arquitetura não pode depender de scrollback ou de conectividade viva para recuperar um run.

## B. Validação da arquitetura atual

| Parte atual | Classificação | Decisão |
|---|---|---|
| Maestri → Claude Maestro → Codex Builder | CHANGE | Manter ownership, mas Claude deve chamar capabilities/roles versionadas e o estado deve viver fora do canvas. Para tarefas independentes, permitir fan-out controlado; para dependentes, sequência explícita. |
| Builder separado do Reviewer | KEEP | É condição de confiança. O Reviewer recebe diff, acceptance, evidência e contexto mínimo em sessão fresca. |
| `scripts/verify.sh` como gate | CHANGE | Manter como contrato universal, mas o script deve emitir artefato estruturado, IDs dos comandos, exit codes, duração e fingerprint do workspace. O conjunto de checks deve ser profileado por risco. |
| `MISSION.md` | CHANGE | Manter como projeção legível/briefing imutável da missão, gerado a partir do estado estruturado e referenciado por `mission_id`. Não usar como lock ou banco. |
| `TASKS.md` | CHANGE | Manter como visão humana do DAG de tarefas. A transição real deve ser transacional em `tasks`/`task_attempts`. |
| `RUNLOG.md` | CHANGE | Manter como relatório resumido, não como log completo. O event log append-only guarda eventos, payloads redigidos, hashes e correlação. |
| Maestri Floors | KEEP + NARROW | Bom para cópia isolada do workspace e coordenação visual. Não é sandbox de segurança contra código hostil; combinar com worktree e container/sandbox. |
| Git worktree | ADD/KEEP | Deve ser o isolamento padrão de código por tarefa/branch. Floor pode criar e apresentar o worktree. |
| Container/sandbox | ADD | Obrigatório para código não confiável, MCP externo, browser, scripts destrutivos ou credenciais. Tokens não ficam acessíveis ao processo que executa código gerado. |
| Loop AUDIT → PLAN → TASK → BUILD → VERIFY → REVIEW | KEEP + FORMALIZE | Manter a ordem, com estados, timeouts, budgets, idempotency keys, stop reasons e transições ilegais rejeitadas deterministicamente. |
| “Máximo 3 tentativas” | CHANGE | Definir no máximo 3 tentativas totais por tarefa, normalmente uma execução inicial + até duas correções. Um retry só é permitido com feedback novo, mudança de input/contexto ou falha explicitamente transitória. |
| Reviewer como autoridade final | CHANGE | Reviewer recomenda PASS/FAIL; apenas Loop Controller promove o estado, e Human Gate aprova merge/deploy/risco alto. |
| Memória em arquivos ou graph externo | CHANGE | Memória é derivada e tenant-scoped; Postgres/CRM é autoridade. Mem0/Graphiti são projeções reconstruíveis. |
| Observabilidade baseada em Sentry/log textual | ADD | Adicionar run/event/trace/span estruturado, token/cost accounting, tool/policy/approval events e redaction. Sentry permanece vista de erro, não fonte canônica. |
| CI remoto como pressuposto | REMOVE | Não assumir que workflow versionado executa. O gate precisa declarar local, Preview, CI ou ausente. Reativação de CI é decisão separada do Dono. |
| Deploy/merge automático após PASS | REMOVE | Substituir por Human Gate físico. PASS do código não autoriza publicação. |
| Agente decide seu próprio budget/policy | REMOVE | Budget, permissões, risco e approval são impostos pelo runtime externo ao modelo. |
| Novo framework paralelo ao Agent Engine | REMOVE | Reutilizar `lib/agent-engine`; adapters de LangGraph/Inngest/Vercel/OpenAI/Anthropic entram somente atrás de ports e após benchmark. |

## C. Arquitetura final proposta

```text
OWNER / HUMAN GATE
        │ objetivo, aprovação, cancelamento, decisão de risco
        ▼
MAESTRI CONTROL PLANE
  Canvas · Roles · Notes · Connections · Floors · Partituras
        │ transporta comandos; não é fonte de verdade
        ▼
CLAUDE MAESTRO / MANAGER
  audit → escopo → plano → DAG → delegação → decisão
        │ context packet + task contract + capability grants
        ▼
TASK / CONTEXT / STATE SERVICE
  Postgres state + append-only event_log + checkpoints + evidence store
        │
        ├──────────────► CODEX BUILDER (isolated worktree + sandbox)
        │                  implementa somente o task contract
        │
        ├──────────────► DETERMINISTIC VERIFICATION ENGINE
        │                  tests · lint · types · build · integration · security · smoke
        │
        └──────────────► INDEPENDENT REVIEWER (fresh context, read-only)
                           rubric · diff · evidence · risk · PASS/FAIL
                                      │
                         LOOP CONTROLLER / POLICY ENGINE
                 retry com feedback · checkpoint · cancel · escalate
                                      │
                 PASS → READY_FOR_HUMAN → merge/deploy somente aprovado
                 FAIL → bounded retry ou BLOCKED_OWNER
```

O padrão default é “manager stays in control”: Claude Maestro não entrega a conversa ao Builder. Handoff para um especialista só existe quando o especialista é dono legítimo daquela próxima decisão. Para revisão, sempre “agent as tool”/worker controlado, com saída estruturada.

## D. Componentes e responsabilidades

### Maestro

Interface operacional, visualização, transporte, recrutamento e conexão. Mostra estado, permite inspeção humana, cria Floor e associa Notes/Portals. Não pode ser a única fila, não pode guardar apenas em drafts e não pode inferir PASS a partir de texto de terminal.

### Maestro/Loop Controller

Máquina de estados durável. Aceita comandos idempotentes (`start`, `resume`, `cancel`, `approve`, `reject`, `retry`, `escalate`), valida transições, aplica budgets/policies, grava eventos, gera checkpoints e decide terminal state. É o único componente autorizado a incrementar tentativa e promover `VERIFYING` → `REVIEW` → `READY_FOR_HUMAN`.

### Builder

Executa um task contract em um worktree/floor dedicado. Pode ler somente o context packet, fontes de verdade declaradas e arquivos do escopo; pode usar apenas capabilities concedidas. Produz diff, testes adicionados/alterados, comandos executados, falhas, riscos e handoff. Não marca PASS, não altera acceptance e não aprova merge.

### Verification Engine

Executa profiles determinísticos fora do modelo. Cada check tem ID, comando, timeout, ambiente, exit code, stdout/stderr redigido, duração e artifact URI. Falha de infraestrutura é diferente de falha de produto. `scripts/verify.sh` é o adapter CLI, não a lógica inteira.

### Reviewer

Sessão nova, modelo/role independente quando possível, read-only no diff e no evidence bundle. Verifica aderência ao acceptance, regressões, segurança, escopo, qualidade e se a evidência é real. Não executa reparo no mesmo ciclo, não edita arquivos, não muda fixtures para obter verde. Emite `PASS`, `FAIL` ou `BLOCKED_REVIEW` com findings classificados.

### Context Engine

Resolve autoridade e relevância: missão, task, acceptance, arquivos afetados, regras aplicáveis, decisões, eventos recentes, evidências e histórico de falha. Gera pacotes por papel e registra exatamente o que foi entregue ao agente. Contexto bruto continua recuperável no event log/evidence store.

### State e Evidence Store

Postgres é a fonte transacional; event log é append-only; objetos grandes (logs, screenshots, patches, reports) vão para storage endereçado por hash. Git guarda código e documentos versionados. Markdown é uma projeção para leitura humana.

### Evals

Datasets de tarefas reais, invariantes, golden cases e transcripts anonimizados. Graders determinísticos primeiro; model grader apenas para dimensões que não sejam verificáveis por código; human grader para risco/UX/decisões ambíguas. Cada mudança de prompt/role/tool deve ser comparável por eval e custo.

### Observability

Trace completo com `mission_id`, `task_id`, `attempt_id`, `run_id`, `trace_id`, `parent_span_id`, tenant, actor, agent role/version, model/provider, tools, budgets, tokens, cost, latency, policy, approvals, retries, evidence e terminal status. Payload sensível é redigido por default.

## E. Roles finais

### MAESTRO / ORCHESTRATOR

- Dono: objetivo, decomposição, prioridade, dependências, contexto e decisão de retry/escalation.
- Pode: auditar, planejar, criar tasks, convocar Builder/Verifier/Reviewer, solicitar contexto, pausar e reportar.
- Não pode: implementar diretamente, aprovar seu próprio diff, elevar permissões, alterar acceptance depois do início, fazer merge/deploy ou contornar human gate.
- Saída obrigatória: mission brief, task DAG, riscos, budgets, gates, decisão requerida e critérios de conclusão.

### BUILDER / EXECUTOR

- Dono: alteração técnica dentro do escopo.
- Recebe: task contract congelado, context packet, capabilities e ambiente isolado.
- Pode: editar arquivos permitidos, rodar comandos permitidos, adicionar testes e artefatos.
- Não pode: alterar plano/acceptance/policy, usar segredo fora da capability, declarar PASS, fazer merge/deploy, remover testes/invariantes ou expandir escopo silenciosamente.
- Saída obrigatória: status, resumo, arquivos, diff fingerprint, testes executados, falhas, riscos e handoff para verifier.

### REVIEWER / INDEPENDENT CHECKER

- Dono: julgamento independente contra contrato e evidência.
- Recebe: acceptance original, diff hash, evidence bundle, resultados determinísticos, contexto mínimo e rubric.
- Pode: ler, executar verificações read-only adicionais e reprovar.
- Não pode: corrigir, editar, reescrever acceptance, aceitar “parece funcionar”, ou aprovar ausência de evidência.
- Saída obrigatória: PASS/FAIL/BLOCKED_REVIEW, findings por severidade, checks cobertos, checks não cobertos, risco residual e recomendação de retry ou human gate.

## F. State Model

### Fontes por tipo

| Artefato | Fonte primária | Projeção/uso |
|---|---|---|
| Mission | `missions` + `mission_events` | `MISSION.md` congelado, linkado por ID |
| Tasks/DAG | `tasks`, `task_dependencies`, `task_attempts` | `TASKS.md` gerado para humano |
| Runs/events | `runs`, `run_events` append-only | `RUNLOG.md` resumido; trace viewer |
| Decisions | `decisions`, actor, policy, timestamp, rationale | Note/Markdown legível; nunca texto solto como autoridade |
| Checkpoints | `checkpoints` + state snapshot + git/worktree fingerprint | arquivo de checkpoint e resume token |
| Evidence | object store por SHA + `evidence_manifest` | reports, logs, screenshots, test results |
| Memory | tabelas tenant-scoped/projeções externas | contexto derivado, nunca override do CRM |

### Invariantes do estado

- todo evento tem `event_id`, `occurred_at`, `actor`, `schema_version`, `correlation_id` e hash;
- eventos não são editados; correções são novos eventos;
- transições são validadas em uma transação com optimistic/concurrency lock;
- resume usa o mesmo `run_id` e idempotency keys, não inicia uma execução duplicada;
- segredo, token, PII e conteúdo completo de prompt não entram no log por default;
- cada estado terminal tem `terminal_reason` e evidence pointer ou blocker pointer.

### DDL proposto — PostgreSQL/Supabase

O DDL abaixo é o contrato de referência para V1, não uma migration aplicada. Ele assume o modelo já existente do projeto: `organizations(id)`, `auth.users(id)`, RLS tenant-aware e `event_log` como fato imutável. Nomes que já existirem no Agent Engine devem ser reconciliados antes de qualquer migration; não criar tabelas paralelas por conveniência.

```sql
create type agent_mission_status as enum (
  'draft', 'ready', 'running', 'waiting_human', 'completed',
  'blocked', 'failed', 'cancelled'
);

create type agent_task_status as enum (
  'backlog', 'ready', 'running', 'verifying', 'review',
  'ready_for_human', 'done', 'blocked', 'failed', 'cancelled', 'retrying'
);

create type agent_run_status as enum (
  'running', 'waiting_approval', 'completed', 'blocked',
  'retryable_failure', 'permanent_failure', 'budget_exhausted',
  'policy_denied', 'cancelled'
);

create type agent_attempt_status as enum (
  'created', 'running', 'passed', 'failed', 'cancelled', 'abandoned'
);

create type agent_event_kind as enum (
  'mission.created', 'mission.updated', 'task.created', 'task.ready',
  'task.started', 'task.status_changed', 'run.started', 'run.resumed',
  'run.completed', 'run.failed', 'run.blocked', 'run.cancelled',
  'context.generated', 'agent.invoked', 'tool.requested', 'tool.completed',
  'tool.failed', 'policy.decided', 'approval.requested', 'approval.resolved',
  'checkpoint.created', 'verification.started', 'verification.check',
  'verification.completed', 'review.started', 'review.verdict',
  'retry.scheduled', 'side_effect.committed', 'memory.proposed', 'memory.written'
);

create type agent_risk_class as enum ('R0', 'R1', 'R2', 'R3', 'R4');

create table agent_missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  created_by uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 240),
  objective text not null,
  status agent_mission_status not null default 'draft',
  risk_class agent_risk_class not null default 'R1',
  acceptance jsonb not null default '{}'::jsonb,
  budgets jsonb not null default '{}'::jsonb,
  source text not null default 'maestri',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  terminal_reason text,
  constraint mission_acceptance_object check (jsonb_typeof(acceptance) = 'object'),
  constraint mission_budgets_object check (jsonb_typeof(budgets) = 'object')
);

create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agent_missions(id) on delete restrict,
  organization_id uuid not null references organizations(id),
  parent_task_id uuid references agent_tasks(id) on delete restrict,
  task_key text not null,
  title text not null,
  objective text not null,
  status agent_task_status not null default 'backlog',
  risk_class agent_risk_class not null default 'R1',
  acceptance jsonb not null,
  context_recipe jsonb not null default '{}'::jsonb,
  verification_profile text not null default 'standard',
  allowed_capabilities jsonb not null default '[]'::jsonb,
  max_attempts smallint not null default 3 check (max_attempts between 1 and 3),
  max_runtime_seconds integer not null default 1800 check (max_runtime_seconds between 1 and 86400),
  max_steps integer not null default 100 check (max_steps between 1 and 10000),
  max_tool_calls integer not null default 100 check (max_tool_calls between 0 and 10000),
  max_tokens integer check (max_tokens is null or max_tokens between 1 and 100000000),
  max_cost_micros bigint check (max_cost_micros is null or max_cost_micros >= 0),
  base_git_sha text,
  scope_glob text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  terminal_reason text,
  unique (mission_id, task_key),
  constraint task_acceptance_object check (jsonb_typeof(acceptance) = 'object'),
  constraint task_recipe_object check (jsonb_typeof(context_recipe) = 'object'),
  constraint task_capabilities_array check (jsonb_typeof(allowed_capabilities) = 'array')
);

create table agent_task_dependencies (
  task_id uuid not null references agent_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references agent_tasks(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agent_missions(id) on delete restrict,
  task_id uuid not null references agent_tasks(id) on delete restrict,
  organization_id uuid not null references organizations(id),
  parent_run_id uuid references agent_runs(id) on delete restrict,
  attempt_number smallint not null check (attempt_number between 1 and 3),
  status agent_run_status not null default 'running',
  agent_id uuid,
  agent_version_id uuid,
  role text not null check (role in ('maestro', 'builder', 'verifier', 'reviewer')),
  model_provider text,
  model_name text,
  trigger jsonb not null default '{}'::jsonb,
  budgets jsonb not null default '{}'::jsonb,
  usage jsonb not null default '{}'::jsonb,
  stop_reason text,
  base_state_fingerprint text,
  final_state_fingerprint text,
  context_packet_id uuid,
  evidence_manifest_id uuid,
  trace_id text not null,
  correlation_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (task_id, attempt_number),
  constraint run_trigger_object check (jsonb_typeof(trigger) = 'object'),
  constraint run_budgets_object check (jsonb_typeof(budgets) = 'object'),
  constraint run_usage_object check (jsonb_typeof(usage) = 'object')
);

create table agent_context_packets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  mission_id uuid not null references agent_missions(id) on delete restrict,
  task_id uuid not null references agent_tasks(id) on delete restrict,
  run_id uuid references agent_runs(id) on delete restrict,
  role text not null check (role in ('maestro', 'builder', 'verifier', 'reviewer')),
  schema_version text not null default '1.0.0',
  packet jsonb not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  estimated_input_tokens integer check (estimated_input_tokens is null or estimated_input_tokens >= 0),
  actual_input_tokens integer check (actual_input_tokens is null or actual_input_tokens >= 0),
  created_at timestamptz not null default now(),
  unique (content_hash),
  constraint packet_object check (jsonb_typeof(packet) = 'object')
);

create table agent_attempts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references agent_tasks(id) on delete restrict,
  run_id uuid not null unique references agent_runs(id) on delete restrict,
  attempt_number smallint not null check (attempt_number between 1 and 3),
  status agent_attempt_status not null default 'created',
  feedback jsonb not null default '[]'::jsonb,
  workspace_fingerprint text,
  diff_fingerprint text,
  started_at timestamptz,
  ended_at timestamptz,
  unique (task_id, attempt_number),
  constraint attempt_feedback_array check (jsonb_typeof(feedback) = 'array')
);

create table agent_checkpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  mission_id uuid not null references agent_missions(id) on delete restrict,
  task_id uuid not null references agent_tasks(id) on delete restrict,
  run_id uuid not null references agent_runs(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  state jsonb not null,
  resume_token text not null,
  workspace_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (run_id, sequence),
  constraint checkpoint_state_object check (jsonb_typeof(state) = 'object')
);

create table agent_evidence_manifests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  mission_id uuid not null references agent_missions(id) on delete restrict,
  task_id uuid not null references agent_tasks(id) on delete restrict,
  run_id uuid not null references agent_runs(id) on delete restrict,
  schema_version text not null default '1.0.0',
  status text not null check (status in ('partial', 'complete', 'invalid')),
  items jsonb not null default '[]'::jsonb,
  manifest_hash text not null check (manifest_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (run_id),
  constraint evidence_items_array check (jsonb_typeof(items) = 'array')
);

create table agent_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  mission_id uuid not null references agent_missions(id) on delete restrict,
  task_id uuid references agent_tasks(id) on delete restrict,
  run_id uuid references agent_runs(id) on delete restrict,
  decision_type text not null,
  decision text not null,
  actor_kind text not null check (actor_kind in ('owner', 'maestro', 'policy', 'reviewer', 'system')),
  actor_id uuid,
  rationale text,
  scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table agent_run_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  mission_id uuid not null references agent_missions(id) on delete restrict,
  task_id uuid references agent_tasks(id) on delete restrict,
  run_id uuid references agent_runs(id) on delete restrict,
  sequence bigint not null,
  event_type agent_event_kind not null,
  schema_version text not null default '1.0.0',
  actor_kind text not null check (actor_kind in ('owner', 'maestro', 'builder', 'verifier', 'reviewer', 'policy', 'system', 'tool')),
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  previous_hash text,
  occurred_at timestamptz not null default now(),
  unique (run_id, sequence),
  unique (organization_id, id),
  constraint event_payload_object check (jsonb_typeof(payload) = 'object')
);

create index agent_missions_org_status_idx on agent_missions (organization_id, status, updated_at desc);
create index agent_tasks_mission_status_idx on agent_tasks (mission_id, status, updated_at desc);
create index agent_runs_task_idx on agent_runs (task_id, attempt_number desc);
create index agent_runs_trace_idx on agent_runs (trace_id);
create index agent_events_run_sequence_idx on agent_run_events (run_id, sequence);
create index agent_events_org_time_idx on agent_run_events (organization_id, occurred_at desc);
create index agent_evidence_task_idx on agent_evidence_manifests (task_id, created_at desc);

alter table agent_runs
  add constraint runs_context_packet_fk foreign key (context_packet_id)
    references agent_context_packets(id) on delete restrict,
  add constraint runs_evidence_manifest_fk foreign key (evidence_manifest_id)
    references agent_evidence_manifests(id) on delete restrict;

-- Usa a helper RLS canônica já existente no projeto.
alter table agent_missions enable row level security;
alter table agent_tasks enable row level security;
alter table agent_task_dependencies enable row level security;
alter table agent_runs enable row level security;
alter table agent_context_packets enable row level security;
alter table agent_attempts enable row level security;
alter table agent_checkpoints enable row level security;
alter table agent_evidence_manifests enable row level security;
alter table agent_decisions enable row level security;
alter table agent_run_events enable row level security;

-- Padrão de leitura; writes/deletes exigem policies por role/capability.
create policy agent_missions_tenant_select on agent_missions for select
  using (organization_id in (select public.fn_user_org_ids()));
create policy agent_tasks_tenant_select on agent_tasks for select
  using (organization_id in (select public.fn_user_org_ids()));
create policy agent_runs_tenant_select on agent_runs for select
  using (organization_id in (select public.fn_user_org_ids()));
create policy agent_context_tenant_select on agent_context_packets for select
  using (organization_id in (select public.fn_user_org_ids()));
create policy agent_checkpoints_tenant_select on agent_checkpoints for select
  using (organization_id in (select public.fn_user_org_ids()));
create policy agent_evidence_tenant_select on agent_evidence_manifests for select
  using (organization_id in (select public.fn_user_org_ids()));
create policy agent_decisions_tenant_select on agent_decisions for select
  using (organization_id in (select public.fn_user_org_ids()));
create policy agent_events_tenant_select on agent_run_events for select
  using (organization_id in (select public.fn_user_org_ids()));
```

Regras do DDL: policies de insert/update/delete devem ser desenhadas por role e capability, não copiadas cegamente. Todas as tabelas são tenant-aware; `organization_id` deve ser derivado da sessão/tenant confiável, nunca do body do modelo; `agent_run_events` é append-only via policy/trigger; JSONB guarda payload flexível, mas a validação de envelope e transições ocorre na aplicação e em testes de contrato. Referências para agentes/versions existentes devem usar os tipos canônicos do Agent OS.

## G. Task Lifecycle

```text
BACKLOG → READY → RUNNING → VERIFYING → REVIEW → READY_FOR_HUMAN → DONE
   │          │        │          │          │            │
   ├──────────┴────────┴──────────┴──────────┴────────────┤
   ├→ BLOCKED   ├→ FAILED   ├→ CANCELLED   └→ RETRYING → RUNNING
```

- `BACKLOG`: conhecida, ainda sem contrato executável.
- `READY`: acceptance, dependências, risk class, budget e context recipe completos.
- `RUNNING`: Builder executando em attempt bounded.
- `VERIFYING`: verifier determinístico executando; alteração congelada.
- `REVIEW`: Reviewer independente recebeu evidence bundle.
- `READY_FOR_HUMAN`: técnica PASS, mas publicação/risco exige dono.
- `DONE`: human gate aplicável satisfeito e estado final comprovado.
- `BLOCKED`: depende de decisão/credencial/infra externa; não consumir retries.
- `FAILED`: falha permanente ou tentativas esgotadas com evidência.
- `CANCELLED`: cancelamento humano ou kill switch; side effects futuros negados.

## H. Loop Protocol

1. **AUDIT**: identificar checkout, branch, dirty state, fontes canônicas, implementação parcial, duplicações, riscos e status real. Nunca criar arquitetura paralela antes desta etapa.
2. **PLAN**: congelar mission/task/acceptance, decompor DAG, classificar risco, definir context recipe, capability grants, verification profile, timeout, token/cost budget e human gates.
3. **EXECUTE**: criar/reservar worktree/floor/sandbox; gravar snapshot base; despachar Builder com o contrato mínimo.
4. **VERIFY**: rodar deterministic verifier fora do Builder; cada comando tem timeout e artifact. `PASS` exige todos os checks obrigatórios do profile.
5. **REVIEW**: despachar Reviewer fresco com diff hash e evidence. Se faltou evidência, é FAIL/BLOCKED, não “provavelmente PASS”.
6. **RETRY**: só se o finding for acionável e retryable. Criar novo attempt com feedback estruturado, manter o original imutável, comparar fingerprints e não repetir o mesmo erro sem mudança.
7. **ESCALATE**: após três attempts totais, repetição sem progresso, budget/timeout, policy deny, dependência externa ou decisão arquitetural, emitir `BLOCKED_OWNER`/human request.
8. **DONE**: só após PASS do Reviewer, hash conferido, evidence manifest completo e human gate para merge/deploy/produção quando aplicável.

Stop conditions obrigatórias: max attempts 3, max wall-clock, max model steps, max tool calls, max tokens, max cost, repeated same tool+args+state fingerprint, no-progress threshold, provider retry limit, policy deny, cancellation e kill switch.

Rollback: código não publicado volta por descarte do worktree/branch ou stash nomeado; efeitos externos dependem de idempotency key e compensating action. Nunca “rollback” apagando o event log.

## I. Context Protocol

O Context Engine constrói pacotes independentes:

```text
ContextPacket {
  packet_id, mission_id, task_id, attempt_id,
  objective, acceptance, risk, constraints,
  authoritative_sources[], relevant_files[], rules[],
  decisions[], prior_failure_feedback[],
  allowed_tools[], budgets, verification_profile,
  artifact_refs[], omitted_context_reason[], content_hash
}
```

Regras:

- começar por índice, mapa de arquivos e contratos; abrir conteúdo somente de arquivos relevantes;
- incluir o acceptance verbatim e marcar toda informação histórica como snapshot;
- entregar ao Builder código e regras do escopo, ao Verifier comandos/fixtures/acceptance, ao Reviewer diff/evidence/rubric — não a conversa gigante;
- preferir referências a artifacts e slices de event log a colar logs inteiros;
- carregar tool schemas progressive-disclosure: nome/capability → schema → documentação detalhada somente ao usar;
- resumir resultados grandes no sandbox e retornar apenas agregados, IDs e evidência;
- usar cache por conteúdo/hash quando o prefixo de instrução é o mesmo;
- nunca permitir que memória derivada contradiga CRM/Postgres; resolver conflito pela hierarquia de autoridade;
- registrar `packet_id`, tokens estimados/reais, fontes incluídas e fontes omitidas com razão;
- compaction é reversível porque o original fica no event/evidence store.

### JSON Schema — ContextPacket v1.0.0

Este schema é o contrato wire do pacote entregue a qualquer role. Conteúdo completo de arquivos, prompts e resultados grandes deve ser referenciado por `artifact_refs`, não embutido sem limite. `additionalProperties: false` é intencional: qualquer nova propriedade exige bump de schema ou compatibilidade explícita.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://lumenva.local/schemas/agent-context-packet-1.0.0.json",
  "title": "Agent Context Packet",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "packet_id", "schema_version", "mission_id", "task_id", "attempt_id",
    "role", "objective", "acceptance", "risk", "constraints",
    "authoritative_sources", "relevant_files", "rules", "decisions",
    "prior_failure_feedback", "allowed_tools", "budgets",
    "verification_profile", "artifact_refs", "omitted_context_reason",
    "content_hash", "generated_at"
  ],
  "properties": {
    "packet_id": { "$ref": "#/$defs/uuid" },
    "schema_version": { "const": "1.0.0" },
    "mission_id": { "$ref": "#/$defs/uuid" },
    "task_id": { "$ref": "#/$defs/uuid" },
    "attempt_id": { "$ref": "#/$defs/uuid" },
    "role": { "enum": ["maestro", "builder", "verifier", "reviewer"] },
    "objective": { "type": "string", "minLength": 1 },
    "acceptance": {
      "type": "object",
      "required": ["criteria"],
      "additionalProperties": false,
      "properties": {
        "criteria": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/acceptanceCriterion" } },
        "out_of_scope": { "type": "array", "items": { "type": "string" } },
        "frozen_at": { "$ref": "#/$defs/dateTime" },
        "content_hash": { "$ref": "#/$defs/sha256" }
      }
    },
    "risk": {
      "type": "object",
      "additionalProperties": false,
      "required": ["class", "side_effects", "human_gate_required"],
      "properties": {
        "class": { "enum": ["R0", "R1", "R2", "R3", "R4"] },
        "side_effects": { "type": "array", "items": { "type": "string" } },
        "human_gate_required": { "type": "boolean" },
        "gate_reason": { "type": "string" }
      }
    },
    "constraints": { "type": "array", "items": { "type": "string" } },
    "authoritative_sources": { "type": "array", "items": { "$ref": "#/$defs/sourceRef" } },
    "relevant_files": { "type": "array", "items": { "$ref": "#/$defs/fileRef" } },
    "rules": { "type": "array", "items": { "$ref": "#/$defs/ruleRef" } },
    "decisions": { "type": "array", "items": { "$ref": "#/$defs/decisionRef" } },
    "prior_failure_feedback": { "type": "array", "items": { "$ref": "#/$defs/failureRef" } },
    "allowed_tools": { "type": "array", "items": { "$ref": "#/$defs/toolGrant" } },
    "budgets": { "$ref": "#/$defs/budgets" },
    "verification_profile": { "enum": ["fast", "standard", "schema", "security", "ui", "release", "full"] },
    "artifact_refs": { "type": "array", "items": { "$ref": "#/$defs/artifactRef" } },
    "omitted_context_reason": { "type": "array", "items": { "$ref": "#/$defs/omission" } },
    "content_hash": { "$ref": "#/$defs/sha256" },
    "estimated_input_tokens": { "type": "integer", "minimum": 0 },
    "generated_at": { "$ref": "#/$defs/dateTime" }
  },
  "$defs": {
    "uuid": { "type": "string", "format": "uuid" },
    "dateTime": { "type": "string", "format": "date-time" },
    "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "acceptanceCriterion": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "statement", "testable"],
      "properties": {
        "id": { "type": "string", "pattern": "^[A-Z0-9][A-Z0-9._-]{1,63}$" },
        "statement": { "type": "string", "minLength": 1 },
        "testable": { "type": "boolean" },
        "verification_hint": { "type": "string" }
      }
    },
    "sourceRef": {
      "type": "object", "additionalProperties": false,
      "required": ["kind", "ref", "authority", "content_hash"],
      "properties": {
        "kind": { "enum": ["repo_file", "database", "event", "spec", "external_doc", "user_decision"] },
        "ref": { "type": "string", "minLength": 1 },
        "authority": { "enum": ["authoritative", "derived", "historical"] },
        "content_hash": { "$ref": "#/$defs/sha256" },
        "line_hint": { "type": "string" }
      }
    },
    "fileRef": {
      "type": "object", "additionalProperties": false,
      "required": ["path", "reason"],
      "properties": {
        "path": { "type": "string", "minLength": 1 },
        "reason": { "type": "string", "minLength": 1 },
        "base_sha": { "type": "string", "minLength": 7 },
        "read_only": { "type": "boolean" }
      }
    },
    "ruleRef": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "source", "applies"],
      "properties": {
        "id": { "type": "string" },
        "source": { "type": "string" },
        "applies": { "type": "string" }
      }
    },
    "decisionRef": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "decision", "authority"],
      "properties": {
        "id": { "$ref": "#/$defs/uuid" },
        "decision": { "type": "string" },
        "authority": { "enum": ["owner", "policy", "system", "historical"] },
        "created_at": { "$ref": "#/$defs/dateTime" }
      }
    },
    "failureRef": {
      "type": "object", "additionalProperties": false,
      "required": ["attempt", "class", "finding", "must_change"],
      "properties": {
        "attempt": { "type": "integer", "minimum": 1, "maximum": 3 },
        "class": { "enum": ["product", "infra", "timeout", "policy", "budget", "missing_evidence", "review"] },
        "finding": { "type": "string" },
        "must_change": { "type": "string" },
        "evidence_ref": { "type": "string" }
      }
    },
    "toolGrant": {
      "type": "object", "additionalProperties": false,
      "required": ["name", "operation", "effect", "approval"],
      "properties": {
        "name": { "type": "string" },
        "operation": { "type": "string" },
        "effect": { "enum": ["read", "write", "external_side_effect"] },
        "approval": { "enum": ["none", "policy", "human"] },
        "scope": { "type": "object" }
      }
    },
    "budgets": {
      "type": "object", "additionalProperties": false,
      "required": ["max_attempts", "max_steps", "max_tool_calls", "max_runtime_seconds"],
      "properties": {
        "max_attempts": { "type": "integer", "minimum": 1, "maximum": 3 },
        "max_steps": { "type": "integer", "minimum": 1 },
        "max_tool_calls": { "type": "integer", "minimum": 0 },
        "max_runtime_seconds": { "type": "integer", "minimum": 1 },
        "max_tokens": { "type": "integer", "minimum": 1 },
        "max_cost_micros": { "type": "integer", "minimum": 0 }
      }
    },
    "artifactRef": {
      "type": "object", "additionalProperties": false,
      "required": ["uri", "kind", "sha256", "sensitivity"],
      "properties": {
        "uri": { "type": "string", "minLength": 1 },
        "kind": { "enum": ["diff", "log", "screenshot", "test_result", "report", "snapshot", "transcript"] },
        "sha256": { "$ref": "#/$defs/sha256" },
        "sensitivity": { "enum": ["public", "internal", "pii_redacted", "secret_excluded"] },
        "media_type": { "type": "string" }
      }
    },
    "omission": {
      "type": "object", "additionalProperties": false,
      "required": ["ref", "reason"],
      "properties": { "ref": { "type": "string" }, "reason": { "type": "string" } }
    }
  }
}
```

### JSON Schema — EventEnvelope v1.0.0

Todos os eventos usam o mesmo envelope. O payload é validado por `event_type`; o envelope abaixo exige os campos comuns e impede que eventos sem correlação sejam persistidos.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://lumenva.local/schemas/agent-event-envelope-1.0.0.json",
  "title": "Agent Event Envelope",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "event_id", "event_type", "schema_version", "organization_id",
    "mission_id", "actor", "occurred_at", "sequence", "correlation_id",
    "trace_id", "payload", "payload_hash"
  ],
  "properties": {
    "event_id": { "type": "string", "format": "uuid" },
    "event_type": { "type": "string", "pattern": "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$" },
    "schema_version": { "const": "1.0.0" },
    "organization_id": { "type": "string", "format": "uuid" },
    "mission_id": { "type": "string", "format": "uuid" },
    "task_id": { "type": ["string", "null"], "format": "uuid" },
    "run_id": { "type": ["string", "null"], "format": "uuid" },
    "attempt_id": { "type": ["string", "null"], "format": "uuid" },
    "actor": {
      "type": "object", "additionalProperties": false,
      "required": ["kind"],
      "properties": {
        "kind": { "enum": ["owner", "maestro", "builder", "verifier", "reviewer", "policy", "system", "tool"] },
        "id": { "type": ["string", "null"], "format": "uuid" },
        "role_version": { "type": ["string", "null"] }
      }
    },
    "occurred_at": { "type": "string", "format": "date-time" },
    "sequence": { "type": "integer", "minimum": 1 },
    "correlation_id": { "type": "string", "minLength": 1, "maxLength": 128 },
    "trace_id": { "type": "string", "minLength": 1, "maxLength": 128 },
    "parent_event_id": { "type": ["string", "null"], "format": "uuid" },
    "payload": { "type": "object" },
    "payload_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "previous_hash": { "type": ["string", "null"], "pattern": "^[a-f0-9]{64}$" }
  }
}
```

Payload contracts mínimos por evento: `run.started` exige `agent_version_id`, `role`, `model_provider`, `model_name` e `budgets`; `context.generated` exige `packet_id`, `content_hash` e token estimate; `tool.requested` exige `tool_name`, `args_hash`, `effect`, `idempotency_key` e policy decision; `verification.check` exige `check_id`, `command`, `exit_code`, `duration_ms`, `result` e `artifact_ref`; `review.verdict` exige `verdict`, `diff_hash`, `evidence_manifest_hash`, `findings` e `reviewer_role_version`; `approval.resolved` exige `decision`, `actor_id`, `scope_hash` e `expires_at`; `run.completed` exige `terminal_reason` e `evidence_manifest_id`. Um payload que não satisfaça o contrato específico é rejeitado antes do append.

## J. Verification Protocol

O profile é selecionado pelo risco e pode ser `fast`, `standard`, `schema`, `security`, `ui`, `release` ou `full`.

### Matriz risco → checks obrigatórios

Classes são cumulativas: um task R3 também executa todos os checks de R0–R2, além dos específicos de R3. Se o diff tocar mais de uma superfície, vale a classe de maior risco. O Builder não escolhe a classe; ela é calculada pelo Loop Controller a partir do escopo e pode ser elevada por policy.

| Classe | Exemplos | Checks obrigatórios | Gate de saída |
|---|---|---|---|
| **R0 — leitura/diagnóstico** | docs, inventário, análise read-only, consulta sem PII | audit de escopo; markdown/link check; schema/format check; reprodução da fonte; secret/PII scan do artefato | Reviewer confirma que não houve mutação e que claims têm evidência |
| **R1 — código local reversível** | função isolada, teste unitário, refactor sem schema/auth/side effect | diff scope + base SHA; format; lint; typecheck; unit focado + suíte unit relevante; build se export/runtime tocar; secret scan; Reviewer independente | PASS determinístico + review; human gate só se política/branch exigir |
| **R2 — integração ou execução controlada** | worker, MCP read-only, tool novo, fila, provider fallback, mudança de runtime | todos de R1; integration tests; contract/schema tests; timeout/retry/idempotency; failure injection; observability trace; sandbox test; dependency scan; smoke em ambiente fresco | PASS + Reviewer; aprovação humana para capability nova ou provider/infra relevante |
| **R3 — dados, tenancy, auth ou side effect externo** | migration, RLS, memória tenant-scoped, webhook, escrita via MCP, browser, billing não produtivo | todos de R2; DB install + update; migration triple; RLS cross-tenant; auth/RBAC matrix server-side; SSRF/input validation; idempotency replay; rollback/compensation test; E2E/API; redaction; secret scan; approval pause/resume; Preview/fresh smoke | PASS + Reviewer + Human Gate obrigatório antes de merge/deploy/alterar dados |
| **R4 — produção/irreversível/crítico** | deploy produção, delete, destructive migration, secrets, auth crítica, dados reais, comunicação externa | todos de R3; change plan; backup/restore ou rollback comprovado; canary/dry-run; production smoke read-only; two-person review quando disponível; explicit owner approval with scope/expiry; kill-switch test; incident/rollback runbook; post-deploy verification | Nunca autonomous. READY_FOR_HUMAN até aprovação; se rejeitado, BLOCKED/CANCELLED |

### Profiles executáveis

| Profile | Uso | Conteúdo mínimo |
|---|---|---|
| `fast` | R0/R1 pequeno | scope, format, lint/typecheck focado, unit focado, secret scan |
| `standard` | R1/R2 | `fast` + unit completo, build, integration relevante, evidence manifest |
| `schema` | qualquer migration/DB/RLS | `standard` + install/update baseline, migrations, invariants, RLS cross-tenant, rollback rehearsal |
| `security` | auth, tools, MCP, browser, secrets, tenancy | `standard` + threat-specific tests, policy matrix, SSRF, redaction, permission denial, replay/idempotency |
| `ui` | UI/Portal/E2E | `standard` + build/start fresco, Playwright, accessibility, screenshots/evidence visual, responsive smoke |
| `release` | branch pronta para publicação | `full` + diff/base audit, dependency/license/secret scan, release notes, rollback/canary, human gate |
| `full` | R3/R4 ou decisão de arquitetura | união de `schema`, `security`, `ui` quando aplicável, E2E, smoke e Reviewer fresco |

### Regras de resultado

- qualquer check obrigatório com exit code diferente de zero produz `FAIL`, exceto falha de infraestrutura claramente classificada como `INFRA_FAIL`, que produz `BLOCKED` até rerun controlado;
- timeout, budget excedido, ausência de artifact, checksum divergente ou output não parseável nunca vira PASS;
- checks opcionais podem ser `NOT_APPLICABLE` somente com justificativa persistida pelo verifier, nunca por decisão do Builder;
- flakiness exige rerun limitado e registro; repetir o comando indefinidamente é falha do harness;
- o Reviewer recebe a classe de risco e confirma que o profile escolhido não foi subdimensionado;
- `READY_FOR_HUMAN` significa “tecnicamente aprovado e aguardando decisão”, não “pronto para produção”.

Checks, em ordem crescente de custo:

1. presença de arquivos, diff scope, formatting e generated-file consistency;
2. unit tests focados;
3. lint e typecheck;
4. testes de invariantes/API/DB/RLS em banco descartável, incluindo install e update quando schema muda;
5. build de produção;
6. integration/worker/MCP/tool contract tests;
7. E2E/Playwright e prova visual para UI;
8. smoke contra ambiente fresco/Preview quando necessário;
9. secret scan, dependency/security scan, SSRF/tenant/auth checks;
10. Reviewer independente;
11. human gate de merge, deploy, produção, destructive migration, secrets, auth crítica ou delete.

`verify.sh` deve falhar fechado, parar em erro obrigatório, distinguir `PRODUCT_FAIL`, `INFRA_FAIL`, `TIMEOUT`, `POLICY_DENY` e `MISSING_EVIDENCE`, e salvar um manifest JSON. Um green rápido nunca significa release-ready se o task tocar DB, auth, E2E ou produção.

## K. Security e human gates

- Prompt nunca é security boundary; policy engine e filesystem/network sandbox são.
- Builder usa identidade e capability grants mínimos; serviço de admin/`service_role` nunca é entregue ao agente.
- Secrets ficam no broker/host seguro e são injetados somente em ferramentas autorizadas; código gerado não lê o ambiente de credenciais.
- MCP é allowlisted por servidor/tool/tenant/operation; tool args passam por schema, policy, idempotency e redaction.
- Browser/Portal recebe perfil separado, domínio allowlist e sessão expirada/isolada; screenshots e logs não contêm cookies.
- Mudanças em auth, tenancy/RLS, LGPD, migrations destrutivas, secrets, billing, deploy e dados reais pausam para o Dono.
- Human approval grava actor, decisão, escopo, timestamp, motivo, estado antes/depois e expiração; timeout de aprovação falha fechado.
- Kill switch por mission/tenant/agent/capability é reavaliado antes de cada side effect.
- Cross-tenant tests são obrigatórios para qualquer mudança de query, memory, tool ou RLS.
- Sem `git push`, merge ou deploy automático só porque Builder/Verifier/Reviewer passaram.

## L. Observability

### Eventos mínimos

`mission.created`, `task.ready`, `run.started`, `context.generated`, `agent.invoked`, `tool.requested`, `policy.decided`, `approval.requested`, `approval.resolved`, `checkpoint.created`, `verification.started`, `verification.check`, `review.started`, `review.verdict`, `retry.scheduled`, `side_effect.committed`, `run.completed`, `run.failed`, `run.blocked`, `run.cancelled`.

### Métricas

- success/pass rate por task, agent version, model/provider e risk class;
- retry rate, repeat-failure rate, no-progress rate, escalation rate;
- verifier failure por check e flaky rate;
- reviewer disagreement com verifier/human;
- p50/p95 latency por fase;
- input/output/cache tokens, tool result tokens, estimated/actual cost;
- approval wait time, sandbox failures, provider fallback rate;
- context hit rate, omitted-context rate e tamanho do packet;
- regressions de eval e custo por successful task.

Traces devem seguir OTel/GenAI quando possível, mas o schema interno e `trace_id` são canônicos. Sentry/Langfuse/PostHog/OTel são adapters/views secundários. Prompts/tool args/results ficam off por default e são opt-in, redigidos e com retenção limitada.

## M. Maestri: Canvas, Maestro Mode, Roles, Notes, Connections, Floors, Partituras

- **Canvas**: uma missão por canvas; nós de Maestri, Claude Maestro, Builder, Verifier, Reviewer, Notes, Portal e Evidence. A disposição é UX, não estado transacional.
- **Maestro Mode**: Claude Maestro recruta/conecta/dismiss agentes, mas cada recrutamento gera `agent_assignment` persistido com role version, capability set e task ID.
- **Roles**: armazenar versões imutáveis de MAESTRO, BUILDER e REVIEWER; role não pode conceder permissão a si mesmo. Mudanças de role iniciam nova versão/eval.
- **Notes**: usar para `MISSION.md`, `TASKS.md`, decisões e handoffs humanos; cada note deve mostrar `source_event_id`, `content_hash` e data. Não guardar segredos.
- **Connections**: representam canais de contexto permitidos: Maestro → Builder recebe task packet; Builder → Verifier recebe evidence; Verifier → Reviewer recebe report; nenhum canal transmite todo o histórico por default.
- **Floors**: cada task de código cria Floor com worktree, base SHA e cleanup policy. Floor não é boundary de segurança suficiente; código não confiável vai para sandbox/container.
- **Partituras**: templates versionados de topologia, roles, notes, connections e policies. Ao carregar uma partitura, resolver versões e validar schema; nunca restaurar permissões secretas implicitamente.
- **Transporte**: se o CLI/event feed estiver indisponível, comandos ficam na fila durável e o runtime continua/reinicia pelo `run_id`. Maestri não perde a missão por terminal fechado.
- **Rotinas**: apenas iniciam uma mission/task; não pulam approval nem mudam branch principal. Cron/routine precisa de lock distribuído e budget diário.

## N. Fases de implementação

As fases abaixo são um plano de implementação, não autorização para executar.

### V0 — Baseline e inventário real

Objetivo: escolher checkout canônico e reconciliar o que existe.  
Dependências: aprovação deste blueprint.  
Componentes: audit manifest, branch/worktree inventory, duplicate detection, current-state correction, capability/risk inventory.  
Arquivos-alvo: `docs/Current-State.md`, `docs/agentic-os/`, inventário somente; não criar segundo engine.  
Validação: `git status`, `git worktree list`, `rg` de state/loop/harness, leitura de Agent OS e verificação de SHAs; nenhum claim sem arquivo:linha ou comando.  
Definition of Done: checkout-alvo escolhido, lista de fontes canônicas, gaps classificados, dirty files preservados e relatório aprovado pelo Dono.

### V1 — Contratos e state/event kernel

Objetivo: tornar mission/task/run/checkpoint/evidence estruturados e duráveis.  
Dependências: V0; schema/tenancy aprovados.  
Componentes: state machine, event schema, optimistic locks, idempotency, evidence manifest, Markdown projections.  
Arquivos-alvo: reutilizar `lib/agent-engine`, migrations novas, `event_log`, `job_queue`, workers e docs; sem substituir CRM truth.  
Validação: unit + DB/RLS + install/update baseline + crash/resume/idempotency tests.  
DoD: toda transição ilegal falha; resume não duplica efeito; `MISSION/TASKS/RUNLOG` podem ser reconstruídos.

### V2 — Loop Controller e Context Engine

Objetivo: formalizar AUDIT/PLAN/EXECUTE/VERIFY/REVIEW/RETRY/ESCALATE.  
Dependências: V1.  
Componentes: attempt budgets, stop conditions, no-progress fingerprint, context recipes/packets, progressive disclosure, redaction.  
Arquivos-alvo: `lib/agent-engine/kernel/`, context/ports existentes, `docs/runbooks/agent-harness.md`, schemas de trace.  
Validação: testes de retry, timeout, repeated tool, provider failure, context omission, token/cost budget.  
DoD: nenhum loop ilimitado; mesma failure não é repetida sem feedback novo; cada agent recebe packet hashado.

### V3 — Isolamento Builder/Verifier/Reviewer

Objetivo: executar tarefas reais com maker≠checker e ambiente isolado.  
Dependências: V2; profiles de verification definidos.  
Componentes: worktree allocator, Floor adapter, sandbox/container profile, Builder contract, deterministic verifier, Reviewer contract, diff hash.  
Arquivos-alvo: reutilizar `loop/`, `.codex/agents/`, scripts de verify e hooks; adicionar apenas adapters necessários.  
Validação: cenário verde, cenário de teste falso, escopo excedido, reviewer que tenta aprovar sem evidência, sandbox sem secret, crash do Builder.  
DoD: Reviewer fresco veta o caso construído; PASS só com evidence manifest e hash conferido.

### V4 — Evals e dataset de regressão

Objetivo: medir qualidade do workflow e não apenas testes do produto.  
Dependências: V3 e traces reais/sintéticos anonimizados.  
Componentes: task dataset, golden cases, deterministic graders, transcript rubric, sampled model grader, comparison runner.  
Arquivos-alvo: fixtures Agent OS existentes, `tests/`, `docs/architecture/agent-os/`.  
Validação: baseline/replay isolado, clean environment por trial, score por sucesso/custo/latência/recovery.  
DoD: mudança de role/tool/prompt gera comparação reproduzível e não promove se regressar hard gate.

### V5 — Observability e custo operacional

Objetivo: explicar todo run e controlar consumo.  
Dependências: V2–V4.  
Componentes: internal trace spans, OTel adapter, token/cost accounting, dashboards/queries, PII redaction, retention.  
Arquivos-alvo: regras de audit/observability, Sentry adapter, event/run tables, runbook.  
Validação: trace de sucesso, fail, retry, approval, provider fallback e cancellation; teste de redaction.  
DoD: run pode ser diagnosticado sem transcript bruto nem narrativa do modelo.

### V6 — Maestri integration e Partituras governadas

Objetivo: conectar Canvas/Maestro Mode/Floors ao state kernel sem acoplá-lo ao processo visual.  
Dependências: V1–V3; capacidades do CLI/event feed confirmadas.  
Componentes: role registry, assignment IDs, context connections, note projections, Floor lifecycle, partitura schema, offline queue.  
Arquivos-alvo: `.maestri/`, `tools/`, docs de integração e adapters; não modificar auth/managed secrets sem gate.  
Validação: fechar/reabrir Maestri, perder transporte, retomar run, restaurar partitura, impedir connection fora do scope.  
DoD: canvas é dispensável para recovery; role/capability/version ficam auditáveis.

### V7 — Assisted autonomy e production gates

Objetivo: promover somente capabilities comprovadas de SHADOW → DRAFT → ASSISTED.  
Dependências: V4–V6, aprovação de risco, evidência de workloads reais.  
Componentes: capability promotion, tenant kill switch, approval pause/resume, release gate, rollback/compensation.  
Arquivos-alvo: runtime/policies, migrations se aprovadas, deploy/runbooks.  
Validação: zero-side-effect SHADOW, DRAFT, R1 approval, R2/R3 pause, denied R4, kill switch mid-run, duplicate resume.  
DoD: nenhuma autonomia customer-facing sem eval, reviewer, observability, rollback e aprovação explícita.

### V8 — Benchmark de runtime e operação contínua

Objetivo: comparar runtime/adapters somente com workload real e critérios fixos.  
Dependências: V4–V7.  
Componentes: benchmark current/alternative provider, fault injection, SLO/cost report, upgrade policy.  
Arquivos-alvo: benchmark já existente da Fase 7 e relatório versionado.  
Validação: execução completa, não apenas focused tests; ambiente limpo; 208/208 ou dataset equivalente; decisão documentada.  
DoD: adoção de Inngest/Vercel Workflow/LangGraph/OpenAI/Anthropic runtime só após superar baseline em confiabilidade, custo, latência e operabilidade.

## O. Ordem exata de execução futura

1. **Aprovar o blueprint** e decidir checkout-alvo, política de CI inativo/reativado e limites de risco.
2. **Executar V0 read-only**: fotografar worktrees, branches, dirty files, Agent Engine, loop, Maestri, docs, migrations e verification state.
3. **Publicar o audit manifest** e obter aceite dos conflitos/duplicações antes de editar qualquer código.
4. **Implementar V1 em branch isolada**: schema/state/event/checkpoint/evidence; não conectar autonomia ainda.
5. **Rodar V1 verification completa** e submeter ao Reviewer independente; human gate para migration/arquitetura.
6. **Implementar V2** sobre os ports existentes; congelar acceptance e criar testes de stop/retry/resume antes do happy path.
7. **Rodar V2 evals determinísticos** com falhas injetadas; corrigir no máximo até o limite de attempts.
8. **Implementar V3** com worktree + sandbox + Builder + `verify.sh` estruturado + Reviewer fresco.
9. **Provar V3** com um task verde e pelo menos quatro tasks de falha: teste omitido, scope creep, repetição e secret access.
10. **Implementar V4 e V5** com dataset/traces reais anonimizados; estabelecer baseline de sucesso, custo, latência e recovery.
11. **Implementar V6** apenas depois de confirmar por comando quais capacidades Maestri suporta; não inventar event feed/WebSocket.
12. **Rodar prova de desconexão**: Maestri fechado, terminal morto e processo reiniciado devem recuperar do state/event log.
13. **Implementar V7 em SHADOW/DRAFT**, por tenant/capability; nenhuma promoção automática.
14. **Submeter cada fase a checkpoint humano** contendo commits, commands, evidence, riscos, custo, pendências e decisão requerida.
15. **Executar V8 benchmark** e somente então escolher/adotar runtime alternativo ou declarar o atual suficiente.
16. **Merge/deploy/produção**: somente após `.approved` humano, checks correspondentes verdes, diff final hash conferido e rollback conhecido.

## Critério final de aceitação do sistema

O Agentic Engineering OS só é considerado pronto quando um run pode ser iniciado, interrompido em approval, ter o harness ou sandbox reiniciado, retomar do mesmo checkpoint sem duplicar side effect, falhar deterministicamente quando exceder budget, ser corrigido por um Builder diferente, ser rejeitado por Reviewer independente, escalar ao Dono com evidência completa e ser diagnosticado depois sem depender de memória de conversa ou scrollback de terminal.

Este arquivo continua sendo somente blueprint. A aprovação do Dono autoriza aprofundamento documental, mas não autoriza implementação, instalação, alteração de secrets, migration, merge, deploy ou mudança de arquitetura em produção.

## P. Comparação com o setup de referência do Dono

Esta seção foi adicionada após a aprovação do blueprint para testar se houve compressão ou perda de contexto. O setup do Dono é o baseline operacional diário; o blueprint é o desenho de confiabilidade e evolução. A decisão é começar pelo baseline simples e só ativar complexidade adicional quando houver problema real, evidência e aprovação.

### 1. O que o setup do Dono já cobre

| Setup do Dono | Cobertura no blueprint |
|---|---|
| Maestri → Claude Maestro → Codex Builder | Coberto em C, D, E e M como manager-style orchestration. |
| Um Floor por task, sem dois Builders no mesmo working tree | Coberto em B, C, D, M e V3 como worktree/Floor isolado. |
| AUDIT first e reuse before create | Coberto em A, B, E, H, N e O. |
| Tasks pequenas com ID, escopo, acceptance e comandos | Coberto em F, G, H e I; DDL inclui task, acceptance, scope, budgets e verification profile. |
| Builder não aprova e Reviewer é sessão separada | Coberto em B, C, E, H, J e V3. |
| `verify.sh` decide por exit code | Coberto em B e J; o blueprint adiciona manifest, categorias de erro e fingerprints. |
| Retry máximo 3 e parada por repetição/no-progress | Coberto em B, F, G, H, I, DDL e matriz de budgets. |
| Human gates antes de merge/deploy/produção/delete/secrets/auth/migration | Coberto em E, H, K, J e matriz R3/R4. |
| MISSION/TASKS/RUNLOG | Coberto em F, I e M como projeções humanas; o blueprint também define state/event log primário. |
| Task DONE só com acceptance + verification + reviewer + docs + risco conhecido | Coberto em G, H, J e critério final de aceitação. |
| Builder reporta arquivos, comandos, testes e issues | Coberto em E, H, J e L por evidence manifest/trace. |
| Reviewer read-only, contexto limpo e sem corrigir | Coberto em E, H e V3. |
| Partitura reutilizável | Coberto em M como topologia versionada de roles, notes, connections, floors e policies. |
| Nunca merge/deploy automático | Coberto em B, K, M e O. |

### 2. Gaps reais do setup do Dono que devem entrar no blueprint

Estes pontos estavam implícitos ou espalhados, mas não estavam definidos com a precisão do setup de referência:

- **Contrato diário de retorno do Builder:** o blueprint dizia “saída obrigatória”, mas não fixava os campos literais. Incorporar: `FILES_CHANGED`, `COMMANDS_RUN`, `TEST_RESULTS`, `KNOWN_ISSUES`, `STATUS=READY_FOR_REVIEW|FAILED`.
- **Contrato diário de retorno do Maestro:** incorporar `TASK`, `STATUS`, `O_QUE_FOI_ALTERADO`, `TESTES_EXECUTADOS`, `RESULTADO`, `RISCOS`, `PROXIMO_PASSO` como view humana do run.
- **Saída do Reviewer:** o setup é mais claro ao restringir a saída a `PASS` ou `FAIL`; em `FAIL`, exigir `Blocking`, `Evidence` e `Recommended action`. O blueprint deve manter metadados estruturados internamente, mas a interface humana deve ser curta.
- **Regra de premissa incorreta:** o Builder deve parar e reportar ao Maestro quando a premissa do task estiver errada, antes de criar solução paralela. Adicionar como stop condition explícita.
- **Status visível em TASKS:** fixar os valores operacionais `BACKLOG`, `READY`, `RUNNING`, `VERIFYING`, `REVIEW`, `BLOCKED`, `READY_FOR_HUMAN`, `DONE`, com `FAILED`, `CANCELLED` e `RETRYING` como estados de exceção controlados.
- **Vocabulário de RUNLOG:** fixar eventos mínimos humanos: `AUDIT_STARTED`, `AUDIT_COMPLETED`, `BUILDER_STARTED`, `VERIFICATION_FAILED`, `RETRY`, `VERIFICATION_PASS`, `REVIEW_PASS`, `READY_FOR_HUMAN`. O event log pode ter eventos mais granulares, mas a projeção RUNLOG deve usar este vocabulário.
- **Prompt padrão @Maestro:** o blueprint definia o role, mas não o prompt operacional diário em formato copiável. Incorporar um prompt curto, apontando para os contratos e proibindo conclusão baseada em auto-relato.
- **Exemplo de ponta a ponta:** adicionar um cenário de notificação interna para demonstrar audit → task → floor → build → fail → retry → verify → review → human gate.
- **Nome da partitura:** registrar `Lumenva Engineering Loop` como partitura inicial reutilizável.

Esses gaps são de ergonomia operacional e contratos de handoff, não de arquitetura de persistência ou segurança.

### 3. Onde o setup do Dono é mais simples e deve prevalecer

- **Topologia mínima:** o blueprint não deve recrutar agentes adicionais por padrão. A configuração aprovada fica exatamente:

  ```text
  1 Claude Code permanente = MAESTRO / Maestro Mode ON
  1 Codex sob demanda = BUILDER
  1 Claude ou Codex temporário, sessão limpa = REVIEWER
  1 verifier determinístico = processo/script, não agente LLM
  ```

- **Sem subagentes auxiliares automáticos:** “Verifier”, “Context Engine”, “Loop Controller”, “Policy Engine” e “Observability” são componentes do sistema, não novos agentes conversacionais.
- **Floor como default:** para o fluxo cotidiano, Maestri Floor é a abstração de isolamento principal. Worktree é a implementação Git por baixo; container/sandbox só é ativado por risco ou código não confiável.
- **Reviewer com resposta curta:** PASS/FAIL é melhor para reduzir ambiguidade e custo. Dados detalhados permanecem no evidence bundle.
- **Markdown como interface operacional:** MISSION/TASKS/RUNLOG são mais diretos para o Dono e para agentes em uma sessão. Não precisam ser substituídos na experiência diária por uma UI ou banco visível.
- **Retry simples:** três tentativas totais e bloqueio por repetição é suficiente para começar; não criar scheduler sofisticado, swarm ou consenso multi-agent sem falha observada que justifique.

Conclusão: o blueprint respeita a restrição de agentes. Sua linguagem de “componentes” poderia ser lida como uma frota maior, então fica explicitamente corrigida nesta seção.

### 4. Onde o blueprint é mais completo e deve ser mantido

- **Postgres/event log versus Markdown puro:** manter como camada de confiabilidade, porque arquivos Markdown não oferecem atomicidade de transição, concorrência, idempotência, query por tenant, resume seguro ou integridade de sequência. MISSION/TASKS/RUNLOG continuam existindo como projeções humanas.
- **Context packets com JSON Schema:** manter porque o setup do Dono descreve contexto mínimo, mas não registra o que foi incluído/omitido, hash, budget, tools e autoridade. O schema reduz contexto acidental e permite validação automática.
- **Evidence manifest e hashes:** manter porque “testes executados” sem artifact, exit code e fingerprint ainda é auto-relato. O setup operacional deve continuar simples na interface, mas guardar prova verificável por baixo.
- **Matriz R0–R4:** manter porque o setup lista human gates corretamente, porém não diferencia a profundidade de checks de uma mudança local, RLS, MCP ou produção.
- **Sandbox/container condicionado ao risco:** manter como defesa adicional. Não substituir o Floor; complementar quando secrets, browser, MCP ou código não confiável tornarem o processo hostil.
- **Idempotência e checkpoint/resume:** manter porque retry e aprovação humana podem duplicar side effects se o run for reiniciado sem identidade persistente.
- **Observabilidade estruturada:** manter para diagnosticar provider failure, custo, tokens, latência, tool calls e retries sem depender de RUNLOG textual ou scrollback.
- **Evals:** manter como camada futura, ativada após traces e workloads reais; não transformar o fluxo diário em uma cerimônia de eval para cada task simples.

### 5. Recomendação final consolidada

**Incorporar do setup do Dono:** contratos literais de retorno, saída PASS/FAIL curta do Reviewer, parada por premissa incorreta, vocabulário RUNLOG, status visíveis, prompt diário @Maestro, exemplo de notificações e partitura `Lumenva Engineering Loop`.

**Descartar do setup do Dono somente como fonte primária:** a ideia de que Markdown deve ser o único estado durável. MISSION/TASKS/RUNLOG permanecem obrigatórios na operação humana, mas são projeções auditáveis do state/event model.

**Manter do blueprint:** Postgres/event log, checkpoints, idempotência, context packets, JSON Schemas, evidence manifests, risk matrix, sandbox condicionado ao risco, observabilidade e evals graduais.

**Simplificar explicitamente:** não adicionar agentes além de um Maestro permanente, um Builder Codex sob demanda e um Reviewer temporário. O verifier é determinístico; os demais itens são módulos, policies e storage do harness. Qualquer novo papel LLM exige problema reproduzível, proposta, eval e aprovação do Dono.

### Contratos operacionais incorporados

**Builder handoff:**

```text
TASK: <task-id>
STATUS: READY_FOR_REVIEW | FAILED
FILES_CHANGED: <lista>
COMMANDS_RUN: <comandos reais>
TEST_RESULTS: <pass/fail + evidência>
KNOWN_ISSUES: <lista ou none>
```

**Reviewer verdict:**

```text
PASS
```

ou:

```text
FAIL
Blocking:
1. <problema>
Evidence: <arquivo:linha, teste ou comportamento observado>
Recommended action: <ação objetiva>
```

**RUNLOG projection events:** `AUDIT_STARTED`, `AUDIT_COMPLETED`, `BUILDER_STARTED`, `VERIFICATION_FAILED`, `RETRY`, `VERIFICATION_PASS`, `REVIEW_PASS`, `READY_FOR_HUMAN`.

**Prompt operacional @Maestro:** “Leia `MISSION.md`, `TASKS.md`, `RUNLOG.md`, `AGENTS.md`, `CLAUDE.md`, README, repo real e Git status antes de agir. Audite o que existe. Reutilize antes de criar. Crie uma task pequena com acceptance, escopo, arquivos, restrições, verificação e limite 3/3. Crie um Floor e delegue um único Builder Codex. Rode verificação determinística; o shell decide PASS/FAIL. Em FAIL, use erro real e feedback novo; em repetição sem progresso, bloqueie. Depois de verification PASS, envie para Reviewer temporário em sessão limpa. Só avance para READY_FOR_HUMAN com Reviewer PASS. Nunca faça merge, deploy, push protegido, delete, secrets, auth crítica, migration destrutiva ou mudança arquitetural irreversível sem Human Gate. Nunca considere concluído porque um agente disse que terminou.”

**Exemplo de referência:** a feature “notificações internas no CRM” percorre AUDIT → TASK → Floor → Builder → `verify.sh` FAIL → feedback objetivo → retry → `verify.sh` PASS → Reviewer PASS → `READY_FOR_HUMAN` → aprovação → merge/deploy autorizado → DONE. Este exemplo é ilustrativo e não autoriza implementação.
