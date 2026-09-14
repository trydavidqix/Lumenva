# Contratos Canónicos V1 — Operating Core, Agent OS e Waves 1–16

**Estado:** `DRAFT_CANONICAL_SPEC`

**Data:** 2026-09-12

**Escopo:** contratos provider-free para `tenant`, `policy`, `agent`, `event`, `source` e `evidence`, incluindo permissões P0–P4, risco R0–R4, autonomia A0–A5/L0–L4, receipts e estados.

**Base normativa:** `scratch-council/PLANO-MESTRE-DEFINITIVO-2026-09-12.md`, em especial os invariantes constitucionais, Wave 1, Waves 2–4, B1–B4 e gates adicionais. Este documento é especificação; não prova runtime, RLS, provider, migration, deploy, produção ou promoção de autonomia.

## 1. Convenções e fronteira de prova

### 1.1 Classificação

- `MUST`/`DEVE`: requisito obrigatório do contrato.
- `MAY`/`PODE`: comportamento permitido, não obrigatório.
- `DENY`: decisão negativa terminal para a tentativa atual; não é erro de infraestrutura por si só.
- `NOT_PROVEN`: requisito ainda sem evidência executada no checkout/runtime alvo.
- `BLOCKED_EXTERNAL`: falta uma variável, autorização, conta, credencial ou recurso externo.

Cada relatório de gate classifica afirmações como `FACT`, `ASSUMPTION`, `INFERENCE` ou `UNKNOWN` e preserva `PASS`, `FAIL`, `NOT_EXECUTED`, `NOT_PROVEN` e `BLOCKED_EXTERNAL`. Timeout, silêncio, processo iniciado, task criada ou receipt não verificado nunca é `PASS`.

### 1.2 Invariantes não negociáveis

1. `MODEL != AGENT`: modelo/provider é substituível; identidade e versão do agente persistem.
2. `AGENT != PROCESS`: catálogo de agentes não implica processo residente.
3. `organization_id` confiável + RLS é a fronteira canónica de tenancy.
4. Postgres e event log são fontes operacionais; projections são reconstruíveis.
5. Conteúdo externo é dado, nunca instrução de prioridade superior.
6. Autonomia não aumenta autoridade; `P4` nunca é autoexecutável.
7. `intersect(parent, child)` nunca alarga envelope; `persistence_never_raises_authority=true`.
8. Policy, RLS, approvals, locks, retries, receipts e transições são determinísticos e idempotentes.
9. Segredos não entram em prompt, memória, evidence, logs ou Git.
10. UI apenas reflete a decisão do mesmo gate usado por API, MCP, CLI, Job Engine, dispatch, agentes/tools e BrowserMesh.

### 1.3 Identificadores e tempo

Todos os IDs são UUID/ULID opacos, únicos por entidade e não derivados de PII. Timestamps são UTC, ISO-8601, com `created_at <= updated_at`; ordenação causal usa `sequence` monotónica por stream e `event_id` como desempate. Versões de contrato e policy são strings imutáveis (`contract_version`, `policy_version`).

## 2. Contrato `Tenant`

### 2.1 Objetivo

Representar a fronteira de isolamento empresarial. Nenhuma operação de negócio, memória, source, evidence, agente ou receipt pode omitir ou inferir silenciosamente o tenant.

### 2.2 Forma canónica

```ts
type Tenant = {
  tenant_id: string;                 // estável; alias de organization_id
  organization_id: string;            // obrigatório no boundary confiável
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  plan_ref?: string;                 // entitlement é consultado, não confiado do cliente
  policy_namespace: string;          // deve ser organization_id-scoped
  data_region?: string;
  created_at: string;
  updated_at: string;
  version: number;
};
```

Regras:

- `organization_id` vem de sessão/boundary autenticado, nunca do prompt, payload livre ou argumento não validado do modelo.
- `tenant_id` e `organization_id` devem ser consistentes; divergência resulta em `DENY(TENANT_MISMATCH)`.
- `SUSPENDED` permite apenas leitura explicitamente autorizada e ações de recuperação; `CLOSED` não aceita novas mutações.
- Entitlement é externo ao objeto: consultar `organization_plan`/`plan_modules` e validar dependências antes da capability.
- RLS deve aplicar a mesma fronteira em tabelas operacionais e projections; ausência de prova de RLS é `NOT_PROVEN`, nunca aceite implícito.

### 2.3 Boundary de request

```ts
type TenantContext = {
  organization_id: string;
  actor_id: string;
  actor_type: "HUMAN" | "AGENT" | "SYSTEM" | "OWNER_GATEWAY";
  role_ids: string[];
  capabilities: string[];
  request_id: string;
  session_id?: string;
  policy_version: string;
  source: "API" | "MCP" | "CLI" | "JOB" | "DISPATCH" | "BROWSERMESH" | "INTERNAL";
};
```

`TenantContext` é criado no boundary confiável. O conteúdo do pedido pode solicitar um recurso, mas não pode escolher `organization_id`, `actor_id`, capabilities, policy version ou RLS context.

### 2.4 Aceite provider-free

- Dois tenants independentes: leitura e escrita de A não são visíveis em B.
- `organization_id` ausente, conflitante ou alterado no corpo resulta em `DENY`.
- Source, event, evidence e receipt com tenant errado são rejeitados antes da persistência.
- Replays com a mesma chave são idempotentes dentro do tenant correto.

## 3. Contrato `Policy`

### 3.1 Objetivo e ordem de decisão

O Permission/Approval Engine é único. Toda ação segue exatamente:

```text
tenant/RLS
→ entitlement
→ dependências/conflitos
→ role/capability
→ P0–P4
→ risco R0–R4
→ approval
→ action
→ receipt/evidence
```

Falha em qualquer etapa retorna `DENY` ou estado explícito de espera; não há bypass por UI, prompt, MCP, CLI, job, provider ou agente.

### 3.2 Forma canónica

```ts
type Policy = {
  policy_id: string;
  policy_version: string;
  tenant_scope: "TENANT" | "SYSTEM";
  action: string;
  resource_type: string;
  permission_level: "P0" | "P1" | "P2" | "P3" | "P4";
  risk_level: "R0" | "R1" | "R2" | "R3" | "R4";
  required_capabilities: string[];
  approval: ApprovalRule;
  constraints: PolicyConstraint[];
  effect: "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
  effective_from: string;
  effective_to?: string;
  created_by: string;
};

type ApprovalRule = {
  required: boolean;
  count: number;
  reviewer_roles: string[];
  independent_reviewer: boolean;
  p4_human_required: boolean;
  expires_after_seconds?: number;
};

type PolicyConstraint = {
  key: string;
  operator: "EQ" | "NEQ" | "IN" | "NOT_IN" | "LTE" | "GTE" | "MATCH";
  value: string | number | boolean | string[];
};
```

### 3.3 Permissões P0–P4

| Nível | Nome | Exemplos | Regra de execução |
|---|---|---|---|
| `P0` | Observe | ler estado já autorizado, listar metadata redigida | Pode autoexecutar se tenant, scope e policy forem válidos. |
| `P1` | Work | rascunhar, classificar, preparar plano, editar artefacto reversível | Pode autoexecutar dentro do envelope; não envia nem publica. |
| `P2` | Operate | criar/atualizar CRM, disparar job, alterar estado operacional reversível | Exige capability, idempotency key, receipt e evidence; approval conforme risk/policy. |
| `P3` | Sensitive | dados PII/sensíveis, comunicação externa, alteração de entitlements, acesso a secret proxy | Approval explícita e evidence redigida; default `REQUIRE_APPROVAL`. |
| `P4` | Privileged | dinheiro, produção, credenciais, migration, deploy, apagar, autoridade, mudança de policy | Nunca autoexecutável; aprovação humana do owner/reviewer competente e boundary próprio. |

P-level não é risco nem autonomia. Uma ação `P1` pode ser `R4`; uma ação `P3` pode ser de baixo risco operacional, mas continua sensível.

### 3.4 Risco R0–R4

| Nível | Significado | Default |
|---|---|---|
| `R0` | observação sem mutação ou efeito externo | permitir se scope válido |
| `R1` | mutação local reversível, baixo impacto | allow com receipt |
| `R2` | mutação operacional ou job com impacto limitado | approval conforme policy, retry seguro |
| `R3` | efeito externo, PII, custo, publicação ou impacto difícil de reverter | approval explícita, timeout e evidence |
| `R4` | privilégio, dinheiro, produção, apagamento, alteração de autoridade/policy | deny automático sem aprovação humana verificável |

### 3.5 Decisão

```ts
type PolicyDecision =
  | { outcome: "ALLOW"; decision_id: string; policy_version: string; expires_at?: string }
  | { outcome: "DENY"; reason: string; policy_version: string; retryable: boolean }
  | { outcome: "REQUIRE_APPROVAL"; approval_id: string; policy_version: string; expires_at: string };
```

Reasons mínimos: `TENANT_MISMATCH`, `ENTITLEMENT_MISSING`, `DEPENDENCY_MISSING`, `CAPABILITY_MISSING`, `LEVEL_EXCEEDED`, `RISK_UNAPPROVED`, `P4_HUMAN_REQUIRED`, `SCOPE_INVALID`, `POLICY_EXPIRED`, `STALE_VERSION`, `SECRET_BOUNDARY`, `IDEMPOTENCY_REPLAY`, `STATE_TRANSITION_INVALID`.

## 4. Contrato `Agent`

### 4.1 Identidade e lifecycle

Agente é identidade persistente com definição versionada, não modelo nem processo. O catálogo não executa.

```text
catalog → registered → implemented → certified → active
```

Lifecycle de execução/autonomia:

```text
catalog → draft → shadow → assisted → auto_low_risk → auto_expanded_readonly
```

Promoção exige evals, reviewer, policy, evidence, SHA/runtime vinculados e não pode elevar P4 para autoexecução.

### 4.2 Forma canónica

```ts
type AgentDefinition = {
  agent_id: string;
  agent_version: string;
  tenant_scope: "SYSTEM" | "TENANT" | "OWNER";
  organization_id?: string;
  role_id: string;
  status: "CATALOG" | "REGISTERED" | "IMPLEMENTED" | "CERTIFIED" | "ACTIVE" | "SUSPENDED" | "RETIRED";
  execution_state: "DRAFT" | "SHADOW" | "ASSISTED" | "AUTO_LOW_RISK" | "AUTO_EXPANDED_READONLY";
  model_ref: string;
  prompt_version: string;
  skills: string[];
  tools: string[];
  authority: AuthorityEnvelope;
  memory_policy: MemoryPolicy;
  eval_refs: string[];
  manager_agent_id?: string;
  reviewer_role_ids: string[];
  budget_ref?: string;
  created_at: string;
  updated_at: string;
};

type AuthorityEnvelope = {
  permission_levels: ("P0" | "P1" | "P2" | "P3" | "P4")[];
  max_risk: "R0" | "R1" | "R2" | "R3" | "R4";
  autonomy: "A0" | "A1" | "A2" | "A3" | "A4" | "A5";
  tenant_scope: string[];
  resource_scope: string[];
  approval_scope: string[];
  veto_scope: string[];
  parent_agent_id?: string;
  persistence_never_raises_authority: true;
};
```

`intersect(parent, child)` aplica em permission, risk, autonomy, tenant, resource, approval e veto. Campo ausente ou scope mais amplo no filho é `DENY`; não há self-grant, prompt-grant ou herança implícita.

### 4.3 Autonomia A0–A5 e L0–L4

Autonomia é latitude operacional, separada de P-level e risco:

| Nível | Regra |
|---|---|
| `A0` | observar e reportar; sem mutação |
| `A1` | sugerir plano/rascunho; humano executa |
| `A2` | executar P0/P1 reversível dentro do envelope |
| `A3` | executar P2/R1–R2 aprovado por policy, com receipt |
| `A4` | coordenar múltiplos passos de baixo risco; approval por etapa sensível |
| `A5` | autonomia expandida apenas para tarefas explicitamente certificadas; nunca P4 automático |

L-level é limite de loop/continuidade, não authority:

| Nível | Limite |
|---|---|
| `L0` | uma ação, sem retry automático |
| `L1` | sequência curta, retry idempotente limitado |
| `L2` | sessão com checkpoint e handoff |
| `L3` | job multi-etapa com watchdog e budget |
| `L4` | continuidade longa supervisionada; pausa em no-progress, budget ou incidente |

### 4.4 Memory e affect

`memory_policy` define namespaces e retenção; `owner:*`, `home:*` e `company:*` são isolados por default. `affect_state` é bounded, evidence-linked e append-only; personalidade, confiança, memória, handoff e persistência nunca alteram policy, factualidade, preço, segurança, capability, entitlement ou approval.

## 5. Contrato `Event`

### 5.1 Objetivo

Registrar factos de domínio e comandos de transição em event log append-only, com ordenação causal, tenant e idempotência. Event não é receipt e não autoriza ação por si só.

```ts
type DomainEvent = {
  event_id: string;
  event_type: string;
  event_version: string;
  organization_id: string;
  aggregate_type: string;
  aggregate_id: string;
  sequence: number;
  occurred_at: string;
  recorded_at: string;
  actor_id: string;
  actor_type: "HUMAN" | "AGENT" | "SYSTEM" | "OWNER_GATEWAY";
  request_id: string;
  correlation_id: string;
  causation_id?: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  payload_schema: string;
  redaction: "NONE" | "PARTIAL" | "FULL";
};
```

Regras:

- Event payload é schema-versioned e não contém secrets; PII deve ser minimizada/redigida.
- `idempotency_key` é único por tenant, actor e operação definida pela policy.
- Eventos aceites não são apagados silenciosamente; correção usa evento compensatório/supersession.
- Projections podem ser reconstruídas do log; divergência da projection é incidente, não nova fonte.
- Eventos de `P2+` referenciam receipt; eventos de approval referenciam approval/evidence.

## 6. Contrato `Source`

### 6.1 Proveniência e precedência

Source descreve a origem de qualquer facto recuperado, chunk, regra, documento ou artefacto. Precedência canónica:

```text
PROJECT_CANONICAL
> OFFICIAL_VENDOR
> APPROVED_INTERNAL_DOC
> DERIVED_MEMORY
> MODEL_RECOLLECTION
```

Conteúdo externo nunca injeta instrução, capability ou policy.

```ts
type Source = {
  source_id: string;
  source_type: "CODE" | "CANON" | "OFFICIAL_VENDOR" | "INTERNAL_DOC" | "RESEARCH" | "MEMORY" | "MODEL";
  uri_or_ref: string;
  title?: string;
  version?: string;
  commit_sha?: string;
  owner_id: string;
  organization_id?: string;
  license_ref?: string;
  authority_rank: number;
  freshness: "FRESH" | "STALE" | "EXPIRED" | "UNKNOWN";
  confidence: number; // 0..1
  retrieved_at?: string;
  last_verified_at?: string;
  status: "REGISTERED" | "VERIFIED" | "SUPERSEDED" | "REVOKED";
  redaction: "NONE" | "PARTIAL" | "FULL";
};
```

Retrieval é JIT, limitado a 3–8 chunks por tarefa, com ranking por autoridade, freshness, aplicabilidade e evidence. Manifest, source, versão/data, owner, licensing e estado são obrigatórios; ausência torna o item `UNKNOWN`/`NOT_PROVEN` e impede write gate de alto risco.

## 7. Contrato `Evidence`

### 7.1 Objetivo

Evidence é artefacto verificável que sustenta uma decisão, transição, receipt ou claim. Não é o claim e não é prova apenas por existir.

```ts
type Evidence = {
  evidence_id: string;
  evidence_type: "TEST" | "COMMAND" | "HTTP" | "LOG" | "DIFF" | "SCREENSHOT" | "APPROVAL" | "SOURCE_EXCERPT" | "RECEIPT_REF";
  organization_id?: string;
  subject_type: string;
  subject_id: string;
  produced_at: string;
  produced_by: string;
  repo_ref?: string;
  branch?: string;
  sha?: string;
  command?: string;
  exit_code?: number;
  observed_status?: "PASS" | "FAIL" | "NOT_EXECUTED" | "NOT_PROVEN" | "BLOCKED_EXTERNAL";
  artifact_ref: string;
  digest?: string;
  source_refs: string[];
  redacted: boolean;
  expires_at?: string;
};
```

Regras de aceite: evidência deve declarar comando/observação, exit code quando aplicável, SHA/branch quando for código, timestamp, actor e redaction. `PASS_LOCAL` prova apenas o limite local observado; não prova merge, push, deploy, provider, RLS ou produção. Evidence expirada ou fora do SHA final é `NOT_PROVEN` para o gate atual.

## 8. Contrato `Receipt`

### 8.1 Obrigatoriedade

Toda ação efetiva `P2+`, e toda ação externa, deve emitir receipt verificável. Receipt não substitui approval nem evidence; liga ambos.

```ts
type ActionReceipt = {
  receipt_id: string;
  receipt_version: string;
  organization_id: string;
  request_id: string;
  task_id: string;
  session_id?: string;
  agent_id: string;
  agent_version: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  policy_version: string;
  permission_level: "P0" | "P1" | "P2" | "P3" | "P4";
  risk_level: "R0" | "R1" | "R2" | "R3" | "R4";
  autonomy_level: "A0" | "A1" | "A2" | "A3" | "A4" | "A5";
  approval_id?: string;
  reviewer_id?: string;
  idempotency_key: string;
  decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "EXECUTED" | "FAILED" | "COMPENSATED";
  result: Record<string, unknown>;
  evidence_refs: string[];
  redacted: boolean;
  created_at: string;
};
```

Para `P2+`, campos mínimos não opcionais na prática: `agent_id`, `task_id`, tenant, policy/version, reviewer/approval quando requerido, idempotency key, result e evidence redigida. Secret, token, payload bruto de provider e PII desnecessária não podem aparecer.

### 8.2 Idempotência e retry

- Repetição da mesma `idempotency_key` devolve o receipt original ou uma resposta determinística; nunca duplica efeito.
- Retry só ocorre em erro classificado como retryable e dentro do budget/L-level.
- Timeout sem observação do resultado é `UNKNOWN`; não reexecutar efeito externo sem reconciliação.
- Falha parcial gera estado `FAILED` ou `COMPENSATION_REQUIRED`, receipt e evidence; nunca `COMPLETED` por silêncio.

## 9. Estados e transições

### 9.1 Máquina comum de ações

```text
REQUESTED
  → VALIDATING
  → DENIED
  → WAITING_APPROVAL
  → APPROVED
  → DISPATCHED
  → RUNNING
  → SUCCEEDED
  → FAILED
  → COMPENSATION_REQUIRED
  → COMPENSATED
  → CANCELLED
  → EXPIRED
```

Transições inválidas são rejeitadas e registadas. `WAITING_APPROVAL`, `FAILED`, `COMPENSATION_REQUIRED`, `CANCELLED` e `EXPIRED` não são sucesso. `SUCCEEDED` exige receipt/evidence observáveis; `COMPENSATED` exige evidência da compensação.

### 9.2 Estado de gate

```text
NOT_EXECUTED → RUNNING → PASS | FAIL | BLOCKED_EXTERNAL
NOT_PROVEN permanece até nova execução verificável.
```

`PASS` é local ao escopo, SHA, ambiente e comando que o produziram. Não propaga automaticamente para merge, deploy, provider ou produção.

### 9.3 Estados de fonte e evidência

- Source: `REGISTERED → VERIFIED → SUPERSEDED/REVOKED`.
- Evidence: `CAPTURED → REDACTED → VERIFIED → EXPIRED`.
- Receipt: `CREATED → RECONCILED → CLOSED` ou `CREATED → FAILED → COMPENSATED`.
- Agent: lifecycle de catálogo e execução são máquinas separadas; `CATALOG` nunca equivale a `ACTIVE`.

## 10. Matriz de aceitação provider-free

Cada implementação deve ter testes determinísticos, sem provider externo, cobrindo:

1. Dois tenants: allow no tenant correto e `DENY` em cross-tenant para API, MCP, CLI, job e dispatch.
2. Ordem de policy completa: qualquer etapa ausente impede a ação seguinte.
3. Matriz P0–P4 × R0–R4 × A0–A5, incluindo `P4` sempre com `P4_HUMAN_REQUIRED`.
4. `intersect(parent, child)` nunca alarga permission, risk, autonomy, tenant ou resource scope.
5. Agente `catalog` não executa; promoção exige eval, reviewer, policy, evidence e SHA.
6. Prompt injection, self-grant, secret extraction, payload com `organization_id` falso e cross-tenant falham.
7. Event replay e receipt replay são idempotentes; projection pode ser reconstruída.
8. Source sem owner/version/provenance, evidence sem digest/exit code quando aplicável e retrieval fora de 3–8 chunks são rejeitados ou marcados `NOT_PROVEN`.
9. Ações P2+ têm receipt com campos mínimos; PII/secrets ficam redigidos.
10. Retry, timeout, cancelamento, expiração, compensation e state transition inválida produzem estados explícitos.
11. Affect, memory, relationship, handoff e persistência não alteram autorização, factualidade, preço, entitlement ou approval.
12. Flags de runtime cognitivo e Graphiti/Mem0 devem ser fail-closed (`OFF`/`SHADOW`) enquanto o gate externo não existir.

## 11. Dependências entre Waves

| Wave | Contratos consumidos | Gate mínimo |
|---|---|---|
| 1 Operating Core | todos | typecheck, unit, isolamento, policy/receipt/event determinísticos |
| 2 Agent Birth | tenant, policy, agent, source, evidence | roles, skills, tools, projection e certification sem payload interno |
| 3 Session Runtime | tenant, policy, agent, event, source, evidence, receipt | snapshot, lock, handoff, memory gate, quotas e continuidade |
| 4 BrowserMesh/Shift | tenant, policy, event, evidence, receipt | evento acorda worker correto; approval e persistência sem concorrência indevida |
| 5 Command Center | todos | estado, custo, source, evidence, goals e approvals persistidos |
| 6–12 Commercial/Delivery | tenant, policy, event, source, evidence, receipt | cliente comenta/aprova, delivery e integrações com consentimento e redaction |
| 13 Memory/Knowledge | source, evidence, tenant, agent | projections reconstruíveis; Graphiti/Mem0 `OFF`/`SHADOW` até prova |
| 14 Evals/Evolution | agent, policy, event, evidence, receipt | regressão de permission, isolation, freshness, recall e supersession |
| 15 Autonomy | policy, agent, event, receipt, evidence | budgets, watchdog após três ciclos, health e promoção A0–A5 por evidência |
| 16 PsycheOS | agent, policy, event, evidence | cap, decay, trust, repair e prova de não alteração de autoridade |

Dependências não autorizam implementação de provider, migration, deploy ou produção. Cada Wave preserva os contratos anteriores e não cria segundo scheduler, CRM, Memory Gateway ou Permission Engine.

## 12. Checklist de verificação e limites

Antes de declarar um gate:

- confirmar checkout/worktree, branch, SHA completo, status e scope do owner;
- executar o comando completo e guardar saída, exit code, timestamp e artefacto redigido;
- verificar diff/status e ligar evidence ao SHA final;
- separar `PASS LOCAL` de merge, push, deploy, provider, RLS e produção;
- marcar gaps como `NOT_PROVEN` ou `BLOCKED_EXTERNAL`, nunca preencher por inferência;
- não executar migration, alterar `main`, usar credencial, enviar mensagem, cobrar, publicar ou promover autonomia sem autorização própria.

**Conclusão do contrato V1:** a especificação é suficiente para fixtures, typecheck, unit tests e isolamento provider-free. Runtime integrado, RLS real, approval matrix final, providers, deploy, produção, credenciais e autonomia efetivamente promovida permanecem `NOT_PROVEN` até execução no boundary autorizado.
