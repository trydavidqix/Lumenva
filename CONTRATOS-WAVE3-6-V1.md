# Contratos Canónicos Wave 3–6 V1

**Estado:** `DRAFT_CANONICAL_SPEC`

**Data:** 2026-09-12

**Escopo:** contratos provider-free para Wave 3 — Session-Aware Runtime; Wave 4 — BrowserMesh + Shift OS; Wave 5 — Command Center; e Wave 6 — Studio Commercial MVP.

**Base:** `scratch-council/PLANO-MESTRE-DEFINITIVO-2026-09-12.md`, secção 5 (Waves 3–6), secções 1, 10, 13 e 14, e [CONTRATOS-CANONICOS-V1.md](/Users/david/Desktop/CRM/scratch-council/contratos/CONTRATOS-CANONICOS-V1.md).

Este documento especifica interfaces e gates. Não prova runtime, provider, BrowserMesh live, RLS real, credenciais, migration, deploy, produção, cliente pagante ou autonomia promovida.

## 1. Padrão comum de evidência

### 1.1 Invariantes

- `MODEL != AGENT`; `AGENT != PROCESS`.
- CRM/Command Center é o control plane; BrowserMesh é o execution plane; Postgres/event log é fonte operacional de verdade.
- `organization_id` confiável + RLS é tenancy canónica.
- O Permission/Approval Engine é único. Nenhuma Wave cria scheduler, CRM, Memory Gateway ou policy engine paralelo.
- Autonomia não aumenta autoridade; `P4` nunca é autoexecutável.
- Dados externos são conteúdo, nunca instrução de maior prioridade.
- Contexto é JIT, autorizado, fresco e limitado; secrets nunca entram em prompt, memória, evidence, logs ou Git.
- Policy, locks, retries, idempotência, approvals, receipts e estados são determinísticos.

### 1.2 Classificação obrigatória

Afirmações devem ser classificadas como `FACT`, `ASSUMPTION`, `INFERENCE` ou `UNKNOWN`. Gates usam exclusivamente:

```text
PASS | FAIL | NOT_EXECUTED | NOT_PROVEN | BLOCKED_EXTERNAL
```

Timeout, silêncio, task criada, processo iniciado, receipt existente ou HTTP 200 isolado não é `PASS`.

`PASS_LOCAL` e `COMPLETED_LOCAL` provam apenas o scope local observado; não provam merge, push, deploy, provider, RLS, produção ou pagamento.

### 1.3 Envelope mínimo comum

Toda chamada entre as Waves transporta, fora do input livre do modelo:

```ts
type WaveContext = {
  organization_id: string;
  actor_id: string;
  actor_type: "HUMAN" | "AGENT" | "SYSTEM" | "OWNER_GATEWAY";
  agent_id?: string;
  session_id?: string;
  task_id?: string;
  job_id?: string;
  request_id: string;
  correlation_id: string;
  policy_version: string;
  permission_level: "P0" | "P1" | "P2" | "P3" | "P4";
  risk_level: "R0" | "R1" | "R2" | "R3" | "R4";
  idempotency_key: string;
};
```

O boundary confiável resolve `organization_id`, actor, capabilities, plano, RLS, policy version e request ID. Payload do modelo, browser ou cliente não pode sobrescrever esses campos.

### 1.4 Receipt e evidence

Toda ação mutável `P2+`, dispatch, approval, handoff, efeito externo ou mudança de estado gera receipt com `organization_id`, `request_id`, `task_id`/`job_id`, actor, agent, policy/version, permission, risk, idempotency key, decisão, result, reviewer/approval quando aplicável e evidence redigida.

Toda evidence deve ligar-se a timestamp, comando/observação, exit code quando aplicável, branch/SHA/worktree quando for código, artifact redigido e estado observado. Receipt não substitui evidence verificada.

## 2. Máquina de estados compartilhada

### 2.1 Execução

```text
REQUESTED
  → VALIDATING
  → WAITING_APPROVAL
  → AUTHORIZED
  → QUEUED
  → DISPATCHED
  → RUNNING
  → CHECKPOINTED
  → SUCCEEDED
```

Saídas válidas:

```text
DENIED | FAILED | RETRYABLE | CANCELLED | EXPIRED | BLOCKED_EXTERNAL | COMPENSATION_REQUIRED | COMPENSATED
```

Estado posterior não é inferido do anterior. `SUCCEEDED` exige resultado e evidence observáveis; falha/timeout sem reconciliação fica `FAILED`, `RETRYABLE`, `BLOCKED_EXTERNAL` ou `NOT_PROVEN`.

### 2.2 Versões e idempotência

- Toda entidade tem `contract_version`/`schema_version` e `policy_version`.
- Repetição de `idempotency_key` devolve o resultado/receipt original ou uma resposta determinística.
- Retry só é permitido para erro explicitamente retryable e dentro do budget/limite L-level.
- Eventos e snapshots são append-only; correções usam evento compensatório/supersession, nunca apagamento silencioso.

## 3. Wave 3 — Session-Aware Runtime

### 3.1 Objetivo e componentes

Implementar runtime determinístico que preserve identidade, estado, contexto, locks, quotas, continuidade e handoff entre adapters sem confundir modelo com agente.

Componentes contratuais:

```text
MockAdapter | GeminiAdapter | GroqAdapter | ClaudeAdapter
SessionService | ContextCompiler | ModelRouter/ModelLock
ToolLoopLock | QuotaService | HandoffPack | MemoryGate
Pulse | DispatchRouter
```

Adapters são substituíveis e não concedem autoridade. Claude é o orquestrador/issuer conforme o plano; nenhum adapter pode criar um orquestrador paralelo.

### 3.2 `SessionState`

```ts
type SessionState = {
  session_id: string;
  organization_id: string;
  agent_id: string;
  agent_version: string;
  task_id?: string;
  execution_epoch: number;
  state_version: number;
  status: "CREATED" | "ACTIVE" | "PAUSED" | "CHECKPOINTED" | "HANDOFF" | "COMPLETED" | "FAILED" | "CANCELLED" | "EXPIRED";
  goal: string;
  constraints: string[];
  facts: string[];
  decisions: string[];
  promises: string[];
  completed: string[];
  pending: string[];
  artifacts: string[];
  errors: string[];
  blockers: string[];
  verification: string[];
  next_action?: string;
  model_lock?: ModelLock;
  tool_loop_lock?: ToolLoopLock;
  context_budget: ContextBudget;
  created_at: string;
  updated_at: string;
};
```

`execution_epoch` identifica uma execução válida; `state_version` usa optimistic concurrency. Escrita com versão velha resulta em `STALE_VERSION`, nunca em merge silencioso. O `SessionService` DEVE suportar `create`, `load`, `checkpoint`, `resume`, `compact`, `handoff` e `cancel`, cada um idempotente e tenant-scoped.

### 3.3 `ModelLock` e `ToolLoopLock`

```ts
type ModelLock = {
  lock_id: string;
  session_id: string;
  model_ref: string;
  adapter_ref: string;
  agent_version: string;
  execution_epoch: number;
  expires_at: string;
};

type ToolLoopLock = {
  lock_id: string;
  session_id: string;
  execution_epoch: number;
  iteration: number;
  max_iterations: number;
  active_tool_call_id?: string;
  expires_at: string;
};
```

Regras:

- Só o lock válido para `execution_epoch` pode continuar o loop.
- Dois workers não podem executar o mesmo `active_tool_call_id`.
- Troca de modelo faz `freeze/checkpoint → novo lock → validação → resume`.
- Lock expirado pausa a sessão e produz receipt/evidence; não autoriza execução por fallback implícito.

### 3.4 `ContextPackage` e `MemoryGate`

```ts
type ContextPackage = {
  package_id: string;
  organization_id: string;
  session_id: string;
  identity: unknown;
  goal: unknown;
  memory_items: ContextItem[];
  knowledge_items: ContextItem[];
  session_items: ContextItem[];
  tool_state: unknown;
  budget: ContextBudget;
  trust_metadata: TrustMetadata;
  source_refs: string[];
  redacted: boolean;
};

type ContextBudget = {
  max_tokens: number;
  max_items: number;
  max_latency_ms: number;
};

type ContextItem = {
  item_id: string;
  namespace: "owner:*" | "home:*" | "company:*" | "tenant";
  authority: number;
  freshness: string;
  provenance: string;
  confidence: number;
  content: unknown;
};
```

`MemoryGate` rejeita tenant errado, namespace indevido, segredo, item expirado, provenance ausente, redaction inválida ou item acima do budget. Contexto empresarial não lê memória pessoal por omissão; contexto pessoal não lê Business OS por omissão.

### 3.5 `HandoffPack`

```ts
type HandoffPack = {
  handoff_id: string;
  session_id: string;
  from_execution_epoch: number;
  to_execution_epoch?: number;
  reason: "PROVIDER_FAILURE" | "QUOTA" | "TIMEOUT" | "MODEL_CHANGE" | "OWNER_REQUEST" | "INCIDENT";
  normalized_goal: string;
  constraints: string[];
  facts: string[];
  decisions: string[];
  promises: string[];
  completed: string[];
  pending: string[];
  artifacts: string[];
  errors: string[];
  blockers: string[];
  verification: string[];
  next_action?: string;
  source_refs: string[];
  evidence_refs: string[];
  redacted: boolean;
};
```

Fluxo obrigatório de falha de provider:

```text
normalize → freeze/checkpoint → handoff → fallback compatível
→ validação → novo lock → resume
```

Falha de provider não pode perder `goal`, constraints, facts, decisions, promises, completed, pending, artifacts, errors, blockers, verification ou next action.

### 3.6 `QuotaService`, `Pulse` e `DispatchRouter`

- Quota é explícita por tenant, agent, session, modelo, tokens, custo, chamadas e tempo.
- Quota excedida pausa/escalona; não troca provider ou amplia budget sem policy.
- Pulse só acorda sessão/job autorizado, com `request_id`, lease, deadline e idempotency key.
- Pulse regista heartbeat e no-progress; após três ciclos sem progresso pausa e escala conforme policy, sem executar efeito externo.
- DispatchRouter valida tenant → entitlement → capability → P-level/risk → approval → lock/quota antes de enfileirar.
- Dispatcher não executa side effect diretamente; entrega comando a um executor com estado e receipt.

### 3.7 Critérios de aceite provider-free da Wave 3

1. MockAdapter reproduz uma sessão completa com snapshot e `state_version` monotónicos.
2. Troca de adapter/modelo preserva `session_id`, `agent_id`, identidade, goal e authority envelope.
3. Escrita stale falha com `STALE_VERSION`; replay idempotente não duplica tool call.
4. ToolLoopLock impede dois workers e encerra no `max_iterations`.
5. Handoff por falha preserva todos os campos obrigatórios; `Unsafe Normal Handoff = 0`.
6. Session State Loss = 0; Tool Duplicate Rate = 0; Tenant Leakage = 0; Tool Loop Continuity = 100%; Structured Output ≥99%; Handoff Continuity ≥95%; Identity Consistency ≥95%.
7. ContextCompiler devolve 3–8 itens JIT quando aplicável, com provenance/freshness/trust e dentro do budget.
8. MemoryGate falha fechado para tenant errado, segredo, namespace pessoal indevido, stale/conflicted item ou provenance ausente.
9. Quota, cancellation, timeout, provider failure e retry deixam estado explícito e receipt.
10. DispatchRouter retorna a mesma decisão para API, MCP, CLI, job e adapter; nenhum bypass por prompt.
11. Crash entre create/load/checkpoint/resume/compact/handoff/cancel permite reconstrução por event log + snapshot, sem perda de estado.

## 4. Wave 4 — BrowserMesh + Shift OS

### 4.1 Objetivo e fronteira

BrowserMesh é o execution plane real a estender, não um runtime reimplementado. Wave 4 liga evento a workforce/shift e ao ciclo:

```text
Event → Workforce → wake → work → persist → sleep
```

Provider-free cobre contratos, fake adapters e simulação; execução BrowserMesh live permanece `NOT_PROVEN` sem boundary autorizado.

### 4.2 `WorkforceAssignment` e `Shift`

```ts
type WorkforceAssignment = {
  assignment_id: string;
  organization_id: string;
  event_id: string;
  role_id: string;
  agent_id: string;
  manager_agent_id?: string;
  reviewer_role_ids: string[];
  authority_envelope_ref: string;
  shift_id: string;
  status: "MATCHED" | "LEASED" | "WORKING" | "PERSISTED" | "SLEEPING" | "FAILED" | "CANCELLED";
  lease_expires_at: string;
  idempotency_key: string;
};

type Shift = {
  shift_id: string;
  organization_id: string;
  scope: string;
  starts_at: string;
  ends_at?: string;
  status: "PLANNED" | "OPEN" | "ACTIVE" | "DRAINING" | "CLOSED" | "CANCELLED";
  budget_ref?: string;
  policy_version: string;
};
```

`role_id`, `agent_id`, shift, tenant, authority e lease são resolvidos pelo control plane. Evento não escolhe livremente o executor.

### 4.3 `ActionBus` e adapters

```ts
type ActionEnvelope = {
  action_id: string;
  organization_id: string;
  assignment_id: string;
  session_id?: string;
  action_type: string;
  target_ref: string;
  permission_level: "P0" | "P1" | "P2" | "P3" | "P4";
  risk_level: "R0" | "R1" | "R2" | "R3" | "R4";
  approval_id?: string;
  idempotency_key: string;
  timeout_ms: number;
  retry_policy: string;
  payload_redacted: unknown;
};
```

ActionBus valida policy e approval, entrega ao adapter allowlisted, recebe resultado e persiste receipt/evidence. Adapter não pode conceder capability, alterar policy, trocar tenant ou ocultar erro.

### 4.4 Grafo de trabalho e concorrência

Cada evento cria um nó/edge de trabalho persistido com `event_id`, assignment, predecessor, dependências e estado. Lease é exclusivo; segundo worker recebe `ALREADY_LEASED` ou `IDEMPOTENT_REPLAY`, nunca executa em paralelo sem policy explícita.

Estados mínimos:

```text
RECEIVED → MATCHED → LEASED → WORKING → PERSISTED → SLEEPING
```

Falhas: `UNMATCHED`, `WAITING_APPROVAL`, `LEASE_EXPIRED`, `FAILED`, `RETRYABLE`, `CANCELLED`, `BLOCKED_EXTERNAL`.

### 4.5 Critérios de aceite provider-free da Wave 4

1. Um evento autorizado acorda o worker/role correto e um evento de outro tenant não é elegível.
2. Evento duplicado não cria dois assignments ou duas ações.
3. Lease impede concorrência indevida e expiração produz reaquisição segura ou estado explícito.
4. Ciclo `wake → work → persist → sleep` deixa event, assignment, action, receipt e evidence ligados.
5. P2+ exige approval quando policy exigir; P4 termina `WAITING_APPROVAL`/`DENY`.
6. Cancelamento, timeout, retry e falha de adapter não deixam assignment como `SUCCEEDED` sem evidence.
7. ActionBus mantém redaction, tenant, actor, capability, policy version e idempotency key.
8. Simulação fake do BrowserMesh passa isolamento, replay, lease, compensation e state transitions.
9. Teste de integração BrowserMesh real, credenciais, browser, produção e provider é explicitamente `NOT_PROVEN` se não executado.

## 5. Wave 5 — Command Center

### 5.1 Objetivo

Command Center é a superfície de controlo e observabilidade sobre o mesmo estado canónico. Não cria autorização paralela e não trata uma projeção visual como fonte de verdade.

Módulos contratuais:

```text
Overview | Chat | Agents | Workforce | Jobs | Workflows | Activity
Sessions | Infrastructure | Dev | Approvals | Incidents | Costs
Projects | Deployments
```

### 5.2 `CommandCenterView` e recursos

```ts
type CommandCenterView = {
  view_id: string;
  organization_id: string;
  actor_id: string;
  view_type: string;
  filters: Record<string, string | number | boolean>;
  data_refs: string[];
  generated_at: string;
  source_event_ids: string[];
  source_evidence_ids: string[];
  freshness: "FRESH" | "STALE" | "UNKNOWN";
  redacted: boolean;
};

type CommandResource = {
  resource_id: string;
  organization_id: string;
  resource_type: "AGENT" | "JOB" | "WORKFLOW" | "SESSION" | "APPROVAL" | "INCIDENT" | "COST" | "PROJECT" | "DEPLOYMENT" | "INFRASTRUCTURE";
  status: string;
  policy_version: string;
  event_refs: string[];
  evidence_refs: string[];
  receipt_refs: string[];
  updated_at: string;
};
```

Overview, Activity, Costs e demais vistas são projections reconstruíveis. Toda ação iniciada na UI chama o gate canónico e produz o mesmo receipt que API/MCP/CLI.

### 5.3 Chat e comandos

Chat pode consultar estado autorizado e propor/encaminhar comando. O texto não é capability. Um comando precisa de `WaveContext`, action/resource scope, P-level/risk, approval quando exigido, idempotency key e receipt. Prompt injection no chat não altera policy ou tenant.

### 5.4 Incidents, costs, approvals e deployments

- Incidente é estado operacional ligado a events, sessions, jobs, receipts e evidence; fechar incidente exige verificação.
- Cost é valor persistido com source, moeda, tenant, owner, categoria, período e evidence; estimativa é `ASSUMPTION`, não custo liquidado.
- Approval é entidade expirável com reviewer, scope, policy version, decision, `expires_at` e evidence; approval fora do scope não vale.
- Deployment view apenas representa estado recebido; botão/ação de deploy é P4 e fica bloqueado sem autorização própria.

### 5.5 Critérios de aceite provider-free da Wave 5

1. Cada módulo filtra por `organization_id` e não expõe recursos de outro tenant.
2. Overview/Activity/Costs podem ser reconstruídos dos eventos e preservam freshness/source/evidence.
3. Chat não executa ação sem policy, capability, approval e receipt correspondentes.
4. Lista de Agents distingue catálogo, registered, implemented, certified, active, shadow e suspended; catálogo não aparece como processo executando.
5. Jobs/Workflows/Sessions mostram state version, execution epoch, locks, retries, quotas e blockers sem inventar sucesso.
6. Approvals expiradas, fora do scope ou com policy stale são recusadas.
7. Incidents não podem ser fechados sem evidence de resolução/verificação.
8. Costs e Deployments distinguem estimativa/local de provider/produção; ausência de live proof permanece `NOT_PROVEN`.
9. API, MCP, CLI e UI produzem decisões equivalentes para a mesma entrada confiável.
10. Loading, empty, error e recovery states existem e não escondem `FAIL`, `BLOCKED_EXTERNAL` ou `NOT_PROVEN`.
11. UI e fluxos de Command Center têm gate de acessibilidade WCAG 2.2 e QA independente; ausência de execução desse gate fica `NOT_EXECUTED`.

## 6. Wave 6 — Studio Commercial MVP

### 6.1 Objetivo e limite

Entregar o primeiro corte comercial de Studio com `ProjectSpec`, briefing, variantes A/B/C, client portal, decisões e propostas. Cliente pode comentar, aprovar ou pedir alterações através de token opaco e evidence. Não inclui Editor completo, Magic Layers, Product Factory, publicação ou cobrança automática.

### 6.2 `ProjectSpec`, briefing e variantes

```ts
type ProjectSpec = {
  project_id: string;
  organization_id: string;
  client_ref: string;
  owner_agent_id?: string;
  title: string;
  objective: string;
  scope: string[];
  constraints: string[];
  deliverables: string[];
  budget_ref?: string;
  deadline?: string;
  consent_refs: string[];
  status: "DRAFT" | "BRIEFING" | "IN_REVIEW" | "DECISION_REQUIRED" | "APPROVED" | "REQUEST_CHANGES" | "DELIVERING" | "DELIVERED" | "CANCELLED";
  version: number;
  source_refs: string[];
  evidence_refs: string[];
};

type StudioVariant = {
  variant_id: string;
  project_id: string;
  label: "A" | "B" | "C";
  version: string;
  summary: string;
  assumptions: string[];
  limitations: string[];
  artifact_refs: string[];
  source_refs: string[];
  evidence_refs: string[];
  status: "DRAFT" | "PRESENTED" | "SELECTED" | "REJECTED" | "SUPERSEDED";
};
```

Briefing mínimo: objetivo, contexto, cliente, constraints, entregáveis, prazo/budget quando autorizados, decisões pendentes, consentimento, owner e próximo passo. Campos desconhecidos ficam `UNKNOWN`; não inventar preço, disponibilidade, prazo, claim ou aprovação.

### 6.3 `ClientPortalToken` e decisões

```ts
type ClientPortalToken = {
  token_id: string;
  project_id: string;
  token_hash: string;
  scope: "VIEW" | "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
  expires_at: string;
  revoked_at?: string;
  single_use?: boolean;
  created_by: string;
};

type ClientDecision = {
  decision_id: string;
  project_id: string;
  variant_id?: string;
  token_id: string;
  decision: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
  comment_redacted?: string;
  actor_ref: string;
  occurred_at: string;
  evidence_refs: string[];
  receipt_id: string;
};
```

Token é opaco, hashado, escopado ao project/tenant, expirável e revogável. Nunca é capability global, não aparece em logs e não autoriza outro projeto. Aprovação de cliente não substitui approval interno de policy, legal, preço, publicação, pagamento ou P4.

### 6.4 Proposta e approval

```ts
type Proposal = {
  proposal_id: string;
  project_id: string;
  organization_id: string;
  version: string;
  scope: string[];
  deliverables: string[];
  assumptions: string[];
  exclusions: string[];
  price_ref?: string;
  payment_terms_ref?: string;
  status: "DRAFT" | "SENT" | "CLIENT_COMMENTED" | "CLIENT_APPROVED" | "INTERNAL_APPROVAL_REQUIRED" | "APPROVED" | "REJECTED" | "EXPIRED";
  source_refs: string[];
  evidence_refs: string[];
  receipt_id?: string;
};
```

Preço, impostos, disponibilidade, legal text e pagamento só podem ser `FACT` quando fornecidos por source/owner autorizados. `CLIENT_APPROVED` não equivale a `PAID`, `DELIVERED` ou `PRODUCTION_PUBLISHED`.

### 6.5 Estados do Studio

```text
PROJECT DRAFT → BRIEFING → IN_REVIEW → DECISION_REQUIRED
  → APPROVED | REQUEST_CHANGES | CANCELLED
APPROVED → DELIVERING → DELIVERED
```

Variante:

```text
DRAFT → PRESENTED → SELECTED | REJECTED | SUPERSEDED
```

Proposal e ClientDecision têm máquinas próprias e ligam-se a `ProjectSpec` por versionamento. Transição inválida, token expirado, project/tenant divergente ou decision duplicada resulta em `DENY`/estado explícito.

### 6.6 Critérios de aceite provider-free da Wave 6

1. Criar `ProjectSpec` com tenant, briefing, source, evidence, owner e next step.
2. Gerar exatamente variantes A/B/C versionadas, com assumptions/limitations e sem claims inventados.
3. Token opaco não permite acesso cross-tenant, cross-project, scope maior ou uso após expiry/revoke.
4. Cliente consegue comentar, aprovar e request changes; cada ação é idempotente, auditável e gera receipt/evidence.
5. Aprovação cliente muda o estado correto, mas não dispara publicação, cobrança, deploy ou entrega sem gates posteriores.
6. Proposal preserva versões, assumptions, exclusions, source/evidence e diferencia `CLIENT_APPROVED`, `APPROVED`, `PAID` e `DELIVERED`.
7. Briefing com informação ausente usa `UNKNOWN`/`ASSUMPTION`; não inventa budget, prazo, preço, disponibilidade ou resolução.
8. PII, consentimento e tokens aparecem apenas no scope autorizado e ficam redigidos em evidence/logs.
9. Testes de replay, decision duplicada, token expirado, mudança concorrente e request changes não produzem estados impossíveis.
10. Client portal live, email, pagamento, publicação, domínio, provider e cliente real ficam `NOT_PROVEN` se não houver execução autorizada.
11. Loading, empty, error e recovery do portal são testados; o gate WCAG 2.2 e QA independente permanece separado e evidenciado.

## 7. Dependências entre Waves 3–6

### 7.1 Grafo canónico

```text
Wave 1 contracts
  → Wave 2 AgentDefinition/Prompt Compiler
    → Wave 3 Session-Aware Runtime
      → Wave 4 BrowserMesh + Shift OS
        → Wave 5 Command Center projections/actions
          → Wave 6 Studio Commercial MVP
```

### 7.2 Dependências detalhadas

| Origem | Destino | Contrato necessário | Falha se ausente |
|---|---|---|---|
| Wave 1 tenant/policy/event/receipt | Wave 3 | context confiável, decisão, idempotência, event log | sessão sem scope/authority ou replay inseguro |
| Wave 2 agent/prompt/evals | Wave 3 | identidade, versão, tools, memory policy, envelope | modelo vira agente ou troca perde identidade |
| Wave 3 session/locks/quotas | Wave 4 | execution epoch, state version, handoff, dispatch | worker duplicado, handoff inseguro ou tool loop concorrente |
| Wave 3 ContextPackage/MemoryGate | Wave 4–6 | JIT, provenance, namespace, budget | leakage, contexto stale ou instrução externa dominante |
| Wave 4 event/workforce/action bus | Wave 5 | assignment, lease, action, receipt/evidence | Command Center mostra estado sem execução auditável |
| Wave 5 views/approvals/incidents | Wave 6 | portal/proposta/decision observáveis | cliente aprova sem state/evidence ou UI bypassa policy |
| Wave 1–5 source/evidence | Wave 6 | provenance, freshness, redaction, SHA/evidence | briefing/proposta sem base verificável |

### 7.3 Regra de avanço

Não iniciar a próxima integração por timeout ou documentação isolada. Cada Wave precisa do gate provider-free da sua secção, com comando, exit code, SHA/status e evidence. Provider/live, BrowserMesh real, RLS, deploy, produção e cliente real exigem gates externos próprios e permanecem `NOT_PROVEN` até execução.

## 8. Gate transversal de aceitação

Classificar esta fatia como `PASS` somente se existirem, no scope declarado:

- typecheck dos contratos e schemas;
- testes unitários de estados e transições inválidas;
- isolamento de dois tenants;
- matriz allow/deny P0–P4 × R0–R4 × A0–A5/L0–L4;
- replay/idempotência e locks concorrentes;
- redaction de tokens, PII e secrets;
- evidence com `FACT/ASSUMPTION/INFERENCE/UNKNOWN` e estados de gate;
- equivalência entre API, MCP, CLI, job, dispatch e UI onde aplicável;
- Wave 3: continuidade/handoff/identity/tool loop conforme métricas do plano;
- Wave 4: event → workforce → wake → work → persist → sleep sem concorrência indevida;
- Wave 5: estado, custo, sources, evidence, goals, approvals e incidents persistidos/reconstruíveis;
- Wave 6: A/B/C, portal tokenizado, comment/approve/request changes e proposal com evidence;
- confirmação de que nenhum `PASS_LOCAL` é relatado como merge, deploy, provider, RLS ou produção.

## 9. Limites e bloqueios explícitos

Os seguintes pontos não são resolvidos por esta especificação:

- runtime BrowserMesh real e credenciais de browser;
- adapters Gemini/Groq/Claude live, quotas de provider e faturação;
- RLS/Postgres/migration replay no checkout real;
- approval matrix final, budgets e promoção A0–A5;
- deploy, produção, domínio, cliente, pagamento, publicação e email;
- tokenização/identidade legal do cliente portal fora do fixture provider-free.

Na ausência de autorização, credencial ou prova observável, classificar como `PRECISA DONO`, `NOT_PROVEN` ou `BLOCKED_EXTERNAL`, com uma única variável faltante e ação necessária. Não inventar sucesso por silêncio.

**Fecho documental:** Waves 3–6 reutilizam os contratos canónicos V1 e permanecem provider-free, fail-closed e verificáveis por fixtures. Nenhum contrato aqui concede autoridade, ativa provider, altera `main`, faz migration, merge, deploy ou produção.
