# Contratos Canónicos Wave 11–15 V1

**Estado:** `DRAFT_CANONICAL_SPEC`

**Data:** 2026-09-12

**Escopo:** contratos provider-free para Wave 11 — Unified Integrations; Wave 12 — Marketing + Video; Wave 13 — Hermes + Advanced Memory; Wave 14 — Evals + Agent Evolution; Wave 15 — Autonomy + Optimization.

**Base:** `scratch-council/PLANO-MESTRE-DEFINITIVO-2026-09-12.md`, secção 5 (Waves 11–15), invariantes constitucionais e [CONTRATOS-CANONICOS-V1.md](/Users/david/Desktop/CRM/scratch-council/contratos/CONTRATOS-CANONICOS-V1.md), [CONTRATOS-WAVE3-6-V1.md](/Users/david/Desktop/CRM/scratch-council/contratos/CONTRATOS-WAVE3-6-V1.md) e [CONTRATOS-WAVE7-10-V1.md](/Users/david/Desktop/CRM/scratch-council/contratos/CONTRATOS-WAVE7-10-V1.md).

Este documento é especificação de contratos, testes e dependências. Não prova provider, conta Meta/Google, WhatsApp, email, voice, storage, Graphiti live, BrowserMesh live, RLS, deploy, produção, publicação, autonomia promovida ou execução financeira.

## 1. Padrão comum de evidência, autoridade e dados externos

### 1.1 Invariantes

- `MODEL != AGENT`; `AGENT != PROCESS`.
- CRM/Command Center continua control plane; BrowserMesh continua execution plane; Postgres/event log continua fonte operacional de verdade.
- `organization_id` confiável + RLS é a fronteira canónica de tenancy.
- Permission/Approval Engine, Memory Gateway, Event Log e Action Bus são únicos; nenhuma Wave cria versão paralela.
- Ordem obrigatória: `tenant/RLS → entitlement → dependências/conflitos → role/capability → P0–P4 → risco → approval → action → receipt/evidence`.
- Autonomia não aumenta autoridade; `P4` nunca é autoexecutável; `intersect(parent, child)` nunca alarga envelope.
- Conteúdo de provider, pesquisa, rede social, contacto, vídeo, memória ou modelo é dado não confiável, nunca instrução de prioridade superior.
- Segredos, tokens, cookies, payloads privados e credenciais não entram em prompts, memória, evidence, logs, datasets ou Git.
- Projections, embeddings, Graphiti, Mem0, rankings, analytics e caches são reconstruíveis e não são fonte operacional.

### 1.2 Classificação e estados de prova

Afirmações usam `FACT`, `ASSUMPTION`, `INFERENCE` ou `UNKNOWN`. Gates usam:

```text
PASS | FAIL | NOT_EXECUTED | NOT_PROVEN | BLOCKED_EXTERNAL
```

Timeout, silêncio, task criada, processo iniciado, receipt existente, HTTP 200, publicação visível, métrica estimada ou embedding criado não é `PASS`. `PASS_LOCAL`/`COMPLETED_LOCAL` limita-se ao checkout/fixture/ambiente observado e não prova provider, produção, cliente, receita ou autonomia.

### 1.3 Envelope confiável

```ts
type CognitiveContext = {
  organization_id: string;
  actor_id: string;
  actor_type: "HUMAN" | "AGENT" | "SYSTEM" | "OWNER_GATEWAY";
  agent_id?: string;
  session_id?: string;
  task_id?: string;
  job_id?: string;
  goal_id?: string;
  request_id: string;
  correlation_id: string;
  policy_version: string;
  permission_level: "P0" | "P1" | "P2" | "P3" | "P4";
  risk_level: "R0" | "R1" | "R2" | "R3" | "R4";
  autonomy_level: "A0" | "A1" | "A2" | "A3" | "A4" | "A5";
  idempotency_key: string;
};
```

Tenant, actor, capabilities, policy, plan, namespace, approval e request ID são resolvidos fora do input livre do modelo/provider. Payload externo não pode sobrescrever esse envelope.

### 1.4 Receipts e evidence

Toda ação mutável `P2+`, ingestão, envio, publicação, alteração de memória, chamada de provider, eval, promoção, dispatch ou mudança de health gera receipt. Mínimos: tenant, actor/agent, task/job/goal, action/resource, policy/version, P-level, risk, autonomy, idempotency key, decisão/result, approval/reviewer quando aplicável e evidence redigida.

Evidence liga comando/observação, timestamp, exit code quando aplicável, branch/SHA/worktree ou provider event ID quando autorizado, artifact/hash, source refs, classificação e estado. Receipt não substitui verificação do efeito.

## 2. Estados e transições compartilhados

### 2.1 Execução

```text
REQUESTED → VALIDATING → WAITING_APPROVAL → AUTHORIZED
→ QUEUED → DISPATCHED → RUNNING → CHECKPOINTED
→ VERIFIED → SUCCEEDED
```

Saídas explícitas:

```text
DENIED | FAILED | RETRYABLE | CANCELLED | EXPIRED
| BLOCKED_EXTERNAL | COMPENSATION_REQUIRED | COMPENSATED | NOT_PROVEN
```

`SUCCEEDED` exige resultado e evidence observáveis. Estado desconhecido nunca é promovido por inferência.

### 2.2 Versionamento, replay e retenção

- Entidades têm `contract_version`/`schema_version`, `policy_version`, `created_at`, `updated_at` e, quando aplicável, `valid_from`, `valid_to`, `supersedes`.
- A mesma `idempotency_key` devolve resultado determinístico; não duplica contacto, publicação, memória, eval, goal, spend, worker ou promoção.
- Retry só ocorre para erro retryable, dentro de limites de tempo, tentativas e budget.
- Histórico de contacto, memória, source, eval, incident, goal e autonomy não é apagado silenciosamente; correções usam supersession/compensation.
- Projections e índices podem ser apagados/reconstruídos, mas o event log e evidence canónicos devem permanecer auditáveis conforme retention policy.

## 3. Wave 11 — Unified Integrations

### 3.1 Objetivo e fronteira

Unificar WhatsApp, Instagram, Facebook, email, voice e Google através de adapters allowlisted, preservando consentimento, Contact, Conversation e Relationship Memory. Provider é boundary; não é autoridade nem source of truth do negócio.

### 3.2 `IntegrationAccount` e `ExternalConnection`

```ts
type IntegrationAccount = {
  integration_id: string;
  organization_id: string;
  provider: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "EMAIL" | "VOICE" | "GOOGLE";
  external_account_ref: string;
  scopes: string[];
  consent_ref?: string;
  secret_ref: string; // referência opaca; nunca o segredo
  status: "DRAFT" | "AUTHORIZED" | "DEGRADED" | "REVOKED" | "EXPIRED" | "BLOCKED_EXTERNAL";
  policy_version: string;
  last_verified_at?: string;
};

type ExternalConnection = {
  connection_id: string;
  integration_id: string;
  organization_id: string;
  adapter_ref: string;
  capabilities: string[];
  egress_policy_ref: string;
  rate_limit_ref?: string;
  idempotency_namespace: string;
  status: "AVAILABLE" | "DEGRADED" | "PAUSED" | "REVOKED";
};
```

Segredo é resolvido apenas por Secret Proxy autorizado. Adapter não pode ler, imprimir, persistir ou enviar secret fora do egress policy.

### 3.3 `Contact`, consentimento e conversation

```ts
type Contact = {
  contact_id: string;
  organization_id: string;
  channel_refs: string[];
  identity_confidence: number;
  consent_refs: string[];
  privacy_scope: string;
  relationship_ref?: string;
  status: "LEAD" | "ACTIVE" | "DO_NOT_CONTACT" | "ERASE_PENDING" | "ERASED";
  source_refs: string[];
  evidence_refs: string[];
};

type ConsentRecord = {
  consent_id: string;
  organization_id: string;
  subject_ref: string;
  purpose: string;
  channel: string;
  legal_basis_ref?: string;
  status: "GRANTED" | "REVOKED" | "EXPIRED" | "UNKNOWN";
  granted_at?: string;
  revoked_at?: string;
  retention_until?: string;
  source_refs: string[];
  evidence_refs: string[];
};

type UnifiedMessage = {
  message_id: string;
  organization_id: string;
  contact_id: string;
  conversation_id: string;
  provider: string;
  provider_message_id?: string;
  direction: "INBOUND" | "OUTBOUND";
  content_redacted: unknown;
  media_refs: string[];
  consent_ref?: string;
  idempotency_key: string;
  status: "RECEIVED" | "VALIDATED" | "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "REDACTED";
  evidence_refs: string[];
};
```

Identidade entre canais exige confidence, provenance e regra explícita; não fazer merge por email/nome inferido sem policy. `DO_NOT_CONTACT`, consentimento ausente, scope inválido, provider revogado ou P3/P4 sem approval resultam em `DENY`/`BLOCKED_EXTERNAL`.

### 3.4 Relationship Memory

```ts
type RelationshipMemoryRef = {
  relationship_id: string;
  organization_id: string;
  contact_id: string;
  namespace: "company:relationship";
  fact_refs: string[];
  confidence: number;
  provenance_refs: string[];
  valid_from: string;
  valid_to?: string;
  privacy_class: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "RESTRICTED";
  supersedes?: string;
  status: "ACTIVE" | "STALE" | "CONFLICTED" | "REDACTED" | "SUPERSEDED";
};
```

Relationship Memory não concede authority, pricing, entitlement, approval ou permission para enviar. Contradições preservam versões; memória pessoal/owner/home nunca é importada por omissão.

### 3.5 Consent, webhook e outbound

- Consentimento é explícito, versionado, purpose-scoped, channel-scoped e revogável.
- Webhook valida assinatura/provider event ID quando disponível, tenant mapping, replay/idempotency e ordem; payload não ativa entitlement ou envio sem policy.
- Outbound exige `Contact`, consent, actor/capability, P-level/risk, rate limit, template/content evidence, approval quando necessário e receipt.
- Erro/timeout do provider não marca `SENT`/`DELIVERED`; reconciliação usa provider event autorizado.
- Voice gravação/transcrição tem consentimento, retenção e redaction próprios; não assumir que áudio é texto factual.

### 3.6 Critérios de aceite provider-free da Wave 11

1. Dois tenants não partilham IntegrationAccount, Contact, Conversation, messages ou relationship memory.
2. Adapter fake normaliza inbound/outbound para o mesmo schema e preserva provider/event/idempotency refs.
3. Consentimento revogado, `DO_NOT_CONTACT`, secret missing, scope inválido e tenant mismatch falham closed.
4. Replay do mesmo webhook/message não duplica Contact, Conversation, Memory ou outbound effect.
5. Identidade cross-channel exige confidence/provenance; conflito fica `CONFLICTED`/`REVIEW_REQUIRED`, não merge automático.
6. Outbound P2/P3/P4 produz receipt/evidence e não envia em timeout/estado desconhecido.
7. Relationship Memory preserva supersession, privacy, freshness e namespace.
8. Prompt injection em mensagem, attachment, OCR, transcript ou metadata não altera policy/capability.
9. Rate limits, retries, dead-letter, cancellation e provider degraded deixam estados explícitos.
10. WhatsApp/Meta/Google/email/voice live, assinatura, egress, conta e produção permanecem `NOT_PROVEN` sem boundary autorizado.

## 4. Wave 12 — Marketing + Video

### 4.1 Objetivo e componentes

Marketing + Video coordena `CMO`, `Research`, `Content`, `SEO/AEO/GEO`, `Creative`, `Community`, `Analytics` e `Teacher/Video`, sempre com provenance, freshness, confidence e métricas por skill. Claim, crise, publicação, gasto, dados pessoais e likeness exigem human-in-the-loop conforme o plano.

### 4.2 `CampaignBrief` e `ContentArtifact`

```ts
type CampaignBrief = {
  campaign_id: string;
  organization_id: string;
  objective: string;
  audience_scope: string;
  channels: string[];
  claims: Claim[];
  constraints: string[];
  budget_ref?: string;
  consent_refs: string[];
  source_refs: string[];
  owner_id: string;
  status: "DRAFT" | "RESEARCH" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "PAUSED" | "CANCELLED";
};

type ContentArtifact = {
  content_id: string;
  campaign_id: string;
  organization_id: string;
  format: "COPY" | "IMAGE" | "VIDEO" | "AUDIO" | "LANDING_PAGE" | "SEO_BRIEF";
  version: string;
  body_ref: string;
  claims: Claim[];
  source_refs: string[];
  evidence_refs: string[];
  freshness: "FRESH" | "STALE" | "UNKNOWN";
  confidence: number;
  status: "DRAFT" | "REVIEW_REQUIRED" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "SUPERSEDED" | "REJECTED";
};

type Claim = {
  text: string;
  classification: "FACT" | "ASSUMPTION" | "INFERENCE" | "UNKNOWN";
  source_refs: string[];
  evidence_refs: string[];
  requires_human_review: boolean;
};
```

Claims não podem ser promovidos por fluência do modelo. `UNKNOWN` não é preenchido por recolha do modelo sem source aprovado.

### 4.3 Research, SEO/AEO/GEO e community

- Research registra query, timestamp, source, autoridade, freshness, licensing, confidence e exclusions; pesquisa não é publicação.
- SEO/AEO/GEO separa keyword/intent, factual claim, source, schema e recomendação; ranking/traffic estimado é `ASSUMPTION`.
- Community exige consentimento, moderation policy, escalation e resposta idempotente; crise, ataque, legal claim ou publicação externa exigem human review.
- Analytics liga evento/métrica a campaign, channel, spend source, period, denominator e confidence; não inventa atribuição.

### 4.4 Video e Teacher

```ts
type VideoSpec = {
  video_id: string;
  organization_id: string;
  campaign_id?: string;
  lesson_id?: string;
  script_ref: string;
  scene_refs: string[];
  audio_refs: string[];
  likeness_refs: string[];
  consent_refs: string[];
  accessibility_refs: string[];
  status: "DRAFT" | "STORYBOARD" | "REVIEW_REQUIRED" | "RENDERED" | "APPROVED" | "PUBLISHED" | "REJECTED";
  source_refs: string[];
  evidence_refs: string[];
};
```

Likeness, voice, música, imagem, copyright e consent são campos obrigatórios quando aplicável. Teacher mantém conteúdo pedagógico, objetivos, versão e evidence separados de marketing; não transforma engagement em prova de aprendizagem.

```ts
type PublicationRequest = {
  publication_id: string;
  organization_id: string;
  content_id: string;
  channel: string;
  target_account_ref: string;
  scheduled_at?: string;
  approval_id?: string;
  idempotency_key: string;
  status: "DRAFT" | "WAITING_APPROVAL" | "AUTHORIZED" | "QUEUED" | "PUBLISHED" | "FAILED" | "BLOCKED_EXTERNAL";
  receipt_id: string;
};
```

### 4.5 Critérios de aceite provider-free da Wave 12

1. Dois tenants isolam CampaignBrief, ContentArtifact, VideoSpec, analytics e sources.
2. Cada claim mostra classificação, source/evidence, freshness, confidence e necessidade de human review.
3. Source stale/revoked, licensing ausente, likeness/consent ausente e P3/P4 bloqueiam approval/publication.
4. Conteúdo A/B ou vídeo é versionado; replay não duplica artifact, schedule ou publish request.
5. SEO/AEO/GEO distingue recomendação/estimativa de facto e não inventa ranking, tráfego ou disponibilidade.
6. Analytics só calcula métrica com evento, fonte, período e denominador observáveis.
7. Moderation/community impede prompt injection, spam, crise sem escalation e outbound sem consent.
8. Video/Teacher preserva script→scene→asset→audio→render→review, redaction e accessibility evidence.
9. Adapter fake e fixtures passam; Meta/Google/voice/CDN/publish live e analytics real ficam `NOT_PROVEN` sem autorização.
10. Falha, cancelamento, review pendente, stale source e provider timeout permanecem explícitos; nunca `PUBLISHED` por preview.

## 5. Wave 13 — Hermes + Advanced Memory

### 5.1 Objetivo e fronteira

Hermes fornece Memory Gateway e memórias semantic, episodic, procedural e operational, com Source Registry, Canon e Freshness Engine. Graphiti é reconstruível e permanece `OFF`/`SHADOW` até gate; nenhuma projection externa vira fonte canónica.

### 5.2 `MemoryRecord` e namespaces

```ts
type MemoryRecord = {
  memory_id: string;
  organization_id?: string;
  namespace: "owner:*" | "home:*" | "company:*" | "tenant";
  subject_ref: string;
  kind: "SEMANTIC" | "EPISODIC" | "PROCEDURAL" | "OPERATIONAL";
  content_redacted: unknown;
  authority: number;
  confidence: number;
  provenance_refs: string[];
  valid_from: string;
  valid_to?: string;
  privacy: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "RESTRICTED";
  lifecycle: "ACTIVE" | "STALE" | "EXPIRED" | "CONFLICTED" | "REDACTED" | "SUPERSEDED";
  extractor_version: string;
  idempotency_key: string;
  supersedes?: string;
};
```

`owner:*`, `home:*` e `company:*` nunca cruzam sem ponte explícita, request ID, purpose, owner approval, capability, resource scope, expiry, revocation, payload redigido, result e evidence. Sem scope/expiry: `DENY`.

### 5.3 `MemoryGateway`

```ts
type MemoryQuery = {
  query_id: string;
  organization_id: string;
  namespace: string;
  subject_ref?: string;
  purpose: string;
  max_items: number;
  max_tokens: number;
  freshness_required: string;
  authority_minimum: number;
  source_refs: string[];
  idempotency_key: string;
};

type MemoryResult = {
  query_id: string;
  item_refs: string[];
  memory_ids: string[];
  source_refs: string[];
  freshness: string;
  confidence: number;
  trust_metadata: Record<string, unknown>;
  redacted: boolean;
  receipt_id: string;
};
```

```ts
type GraphRebuildRun = {
  rebuild_id: string;
  organization_id: string;
  projection: "GRAPHITI" | "MEM0" | "EMBEDDINGS";
  input_watermark: string;
  projection_version: string;
  input_digest: string;
  output_digest?: string;
  mode: "OFF" | "SHADOW" | "REBUILD";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "NOT_PROVEN";
  evidence_refs: string[];
};
```

Write gate é fail-closed para provenance ausente, tenant errado, scope inválido, segredo, redacted incompleto, expiração, inferência de alto risco ou idempotency replay incompatível. Retrieval é JIT, limitado a 3–8 chunks quando aplicável, reranked por autoridade/freshness/aplicabilidade/evidence.

### 5.4 Source Registry, Canon e Freshness Engine

- Source Registry guarda URL/ref, versão/commit, owner, licensing, authority, scope, `retrieved_at`, `last_verified_at`, hash e estado.
- Canon mantém apenas decisões/documentos aprovados; memória derivada não substitui doutrina atual.
- Freshness Engine marca `FRESH`, `STALE`, `EXPIRED`, `UNKNOWN`; source stale não pode sustentar claim de alto risco sem review.
- Contradição cria nova versão/supersession; não apagar história nem escolher por recência apenas.

### 5.5 Graphiti/Mem0 SHADOW

Graphiti/Mem0/embeddings podem receber cópia redigida em `SHADOW`, com IDs, métricas de recall, latency, cost, leakage, wipe/rebuild e redaction. Shadow não escreve authority, não serve production context por omissão e não substitui Postgres-native retrieval.

### 5.6 Critérios de aceite provider-free da Wave 13

1. Dois tenants e namespaces pessoais/empresariais permanecem isolados em write, query, projection e rebuild.
2. MemoryRecord exige provenance, confidence, validity, privacy, lifecycle, extractor version e idempotency.
3. Write gate nega segredo, tenant errado, scope inválido, expired/high-risk inference e replay incompatível.
4. Supersession preserva histórico, versões e source/evidence refs.
5. MemoryGateway respeita budget, freshness, authority, 3–8 chunks, redaction e receipt.
6. Source Registry/Canon/Freshness Engine são reconstruíveis e marcam stale/conflicted/unknown explicitamente.
7. Graphiti/Mem0 OFF/SHADOW não altera decisão, authority, factualidade, preço, entitlement ou approval.
8. Rebuild de projection reproduz resultado sem duplicar memory/event/receipt.
9. Prompt injection em source/memory/query não concede capability ou muda namespace.
10. Graph database, embeddings, crawler, Neo4j e providers live permanecem `NOT_PROVEN` quando não executados.

## 6. Wave 14 — Evals + Agent Evolution

### 6.1 Objetivo e domínios de avaliação

Wave 14 mede recall, supersession, freshness, isolation, permission/red-team e regressão comportamental, preservando estados estritos. Evals são evidência de comportamento observado, não autoridade para auto-promoção.

### 6.2 `EvalSuite`, `EvalCase` e `EvalRun`

```ts
type EvalSuite = {
  suite_id: string;
  version: string;
  organization_id?: string;
  domains: ("RECALL" | "SUPERSESSION" | "FRESHNESS" | "ISOLATION" | "PERMISSION" | "RED_TEAM" | "BEHAVIOR" | "CONTINUITY")[];
  threshold_refs: string[];
  fixture_refs: string[];
  evaluator_ref: string;
  status: "DRAFT" | "CERTIFIED" | "RETIRED";
};

type EvalCase = {
  case_id: string;
  suite_id: string;
  input_ref: string;
  expected_constraints: string[];
  forbidden_behaviors: string[];
  expected_state?: string;
  sensitivity: "SAFE" | "SENSITIVE" | "ADVERSARIAL";
};

type EvalRun = {
  run_id: string;
  suite_id: string;
  subject_type: "AGENT" | "MODEL" | "MEMORY" | "POLICY" | "RUNTIME";
  subject_version: string;
  started_at: string;
  metrics: Record<string, number | string | boolean>;
  failures: string[];
  evidence_refs: string[];
  status: "PASS" | "FAIL" | "NOT_EXECUTED" | "NOT_PROVEN" | "BLOCKED_EXTERNAL";
};
```

```ts
type EvolutionProposal = {
  proposal_id: string;
  subject_type: "AGENT" | "SKILL" | "TOOL" | "PROMPT" | "MODEL" | "MEMORY_POLICY";
  parent_version: string;
  candidate_version: string;
  diff_hash: string;
  changed_capabilities: string[];
  risk_level: "R0" | "R1" | "R2" | "R3" | "R4";
  eval_run_refs: string[];
  rollback_ref: string;
  status: "DRAFT" | "SHADOW" | "CERTIFIED" | "REJECTED" | "REVOKED";
};
```

### 6.3 Regressão, red-team e promoção

- Baseline fixture e holdout são imutáveis por suite; mudanças de threshold exigem policy/version e reviewer.
- Red-team cobre prompt injection, self-grant, secret extraction, cross-tenant, permission bypass, stale memory e unsafe tool loop.
- Regressão compara subject/version anterior e nova; melhoria numa métrica não pode ocultar regressão de isolation/safety.
- Eval `PASS` permite consideração de promoção, nunca concede capability automaticamente.
- Promoção exige eval suite certificada, reviewer independente, policy, evidence, SHA/runtime, incident check e rollback path.

### 6.4 Critérios de aceite provider-free da Wave 14

1. Suite reproduzível executa recall/supersession/freshness/isolation/permission/red-team com fixtures.
2. `EvalRun` liga subject/version, input, thresholds, métricas, failures, evidence e estado.
3. Prompt injection, self-grant, secret extraction e cross-tenant têm casos negativos que falham closed.
4. Stale/conflicted memory e supersession incorreta degradam resultado, não são escondidos por média.
5. Regressão compara baseline/holdout e impede promoção quando isolation/permission/continuity piora.
6. Timeout, fixture ausente, provider unavailable ou suite parcial ficam `NOT_EXECUTED`/`NOT_PROVEN`, não `PASS`.
7. Eval PASS não muda agent status, authority, autonomy, entitlements ou approval sem gate de promoção separado.
8. Reviewer independente, policy/version, SHA/runtime e rollback são obrigatórios para promoção.
9. Resultados são redigidos e tenant-scoped; secret/PII não entram no dataset/evidence.
10. Model/provider live, eval universal e performance em produção permanecem `NOT_PROVEN` sem execução autorizada.

## 7. Wave 15 — Autonomy + Optimization

### 7.1 Objetivo e limites

Wave 15 adiciona Goal Lite, continuity loop, No-progress Watchdog, health states, budgets, Resource Router e promoção A0–A5 baseada em eval, reliability e incidents. Autonomy, budget, organizational level, permission profile, tenant scope, approval scope e veto scope são campos separados.

### 7.2 `GoalLite`

```ts
type GoalLite = {
  goal_id: string;
  organization_id: string;
  owner_id: string;
  title: string;
  objective: string;
  success_criteria: string[];
  constraints: string[];
  allowed_actions: string[];
  forbidden_actions: string[];
  budget_ref?: string;
  risk_ceiling: "R0" | "R1" | "R2" | "R3" | "R4";
  autonomy_ceiling: "A0" | "A1" | "A2" | "A3" | "A4" | "A5";
  health: "ON_TRACK" | "AT_RISK" | "BLOCKED" | "BUDGET_LIMITED" | "COMPLETE";
  status: "DRAFT" | "AUTHORIZED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  evidence_refs: string[];
};
```

Goal não concede capability: cada ação volta ao Permission/Approval Engine. `COMPLETE` exige success criteria e evidence; silêncio ou falta de progresso não é complete.

### 7.3 Continuity Loop e Watchdog

```text
observe state → evaluate next action → policy/approval gate
→ dispatch → persist result/evidence → verify progress → repeat or pause
```

Watchdog conta ciclos sem progresso por goal/session. Após três ciclos sem progresso, marca `AT_RISK`/`BLOCKED`, pausa dispatch e escala conforme policy. Não cria retry infinito, troca budget, eleva autonomy ou cancela evidence automaticamente.

### 7.4 `Budget` e `ResourceRouter`

```ts
type Budget = {
  budget_id: string;
  organization_id: string;
  scope_ref: string;
  currency?: string;
  max_cost?: number;
  max_tokens?: number;
  max_tool_calls?: number;
  max_runtime_ms?: number;
  stop_loss?: number;
  spent: number;
  status: "OPEN" | "WARNING" | "LIMITED" | "EXHAUSTED" | "CANCELLED";
  evidence_refs: string[];
};

type ResourceRoute = {
  route_id: string;
  goal_id?: string;
  task_id: string;
  candidates: string[];
  selected_ref?: string;
  reason: string;
  constraints: string[];
  policy_version: string;
  status: "PROPOSED" | "AUTHORIZED" | "DISPATCHED" | "FAILED" | "BLOCKED";
  receipt_id: string;
};
```

```ts
type HealthState = {
  scope_ref: string;
  organization_id: string;
  state: "ON_TRACK" | "AT_RISK" | "BLOCKED" | "BUDGET_LIMITED" | "COMPLETE";
  reason: string;
  metric_refs: string[];
  owner_id: string;
  changed_at: string;
  evidence_refs: string[];
};
```

ResourceRouter só escolhe entre candidates allowlisted e dentro do envelope/tenant/budget. Não pode escolher provider mais permissivo para contornar deny, nem declarar custo sem source.

### 7.5 Promoção de autonomia

```ts
type AutonomyPromotion = {
  promotion_id: string;
  agent_id: string;
  from_level: "A0" | "A1" | "A2" | "A3" | "A4" | "A5";
  to_level: "A0" | "A1" | "A2" | "A3" | "A4" | "A5";
  eval_run_refs: string[];
  reliability_refs: string[];
  incident_refs: string[];
  reviewer_id: string;
  policy_version: string;
  rollback_ref: string;
  status: "PROPOSED" | "APPROVED" | "APPLIED" | "REVOKED" | "REJECTED";
};
```

Promoção não altera P-level, risk ceiling, tenant scope, approval/veto scope ou capability. `A5` continua sem P4 automático e só pode expandir escopo explicitamente certificado, preferencialmente readonly/baixo risco.

### 7.6 Critérios de aceite provider-free da Wave 15

1. Goal Lite separa objective, constraints, allowed/forbidden actions, budget, risk, autonomy e health.
2. Continuity loop persiste cada ciclo, next action, result, progress evidence e idempotency key.
3. Watchdog após três ciclos sem progresso pausa/escalona; não gera loop infinito ou auto-promoção.
4. Health distingue `ON_TRACK`, `AT_RISK`, `BLOCKED`, `BUDGET_LIMITED` e `COMPLETE` com evidence própria.
5. Budget limits interrompem dispatch antes do efeito e deixam cost/usage receipt; estimativas ficam `ASSUMPTION`.
6. ResourceRouter não atravessa tenant, capability, P-level, risk, approval ou budget para otimizar custo/latência.
7. AutonomyPromotion exige evals, reliability, incidents, reviewer, policy, SHA/runtime, rollback e receipt.
8. Regressão/incidente verificado pode revogar ou reduzir autonomy; persistência não aumenta authority.
9. A0–A5 e L0–L4 são testados separadamente de P0–P4/R0–R4; P4 nunca autoexecuta.
10. Simulation/provider-free passa; autonomia real, recurso real, spend, provider routing e produção permanecem `NOT_PROVEN` sem autorização.

## 8. Dependências entre Waves 11–15

### 8.1 Grafo canónico

```text
Waves 1–10: tenant/policy/session/action/project/asset/build/delivery
       ↓
Wave 11 Unified Integrations: contacts/consent/messages/relationship memory
       ↓
Wave 12 Marketing + Video: sources/claims/content/video/analytics/teacher
       ↓
Wave 13 Hermes + Advanced Memory: Memory Gateway/Canon/Freshness/Graph projections
       ↓
Wave 14 Evals + Agent Evolution: regression/red-team/permission/freshness/recall
       ↓
Wave 15 Autonomy + Optimization: goals/watchdog/health/budgets/routes/promotion
```

### 8.2 Dependências detalhadas

| Origem | Destino | Contrato consumido | Falha se ausente |
|---|---|---|---|
| Waves 1–6 | Wave 11 | tenant, policy, contact/event/evidence/receipt, consent boundary | provider envia para tenant/contact errado ou sem consent |
| Waves 3–6 | Wave 12 | context, project, source, asset, approval, campaign evidence | claim/content/video sem provenance ou approval |
| Wave 11 | Wave 12 | Contact, consent, relationship scope, channel events | marketing cruza contact/namespace ou usa consent revogado |
| Waves 1–12 | Wave 13 | Source Registry, namespaces, event log, MemoryGate, redaction | memory não reconstruível, cross-tenant ou source stale |
| Wave 13 | Wave 14 | memory/query fixtures, freshness, supersession, isolation | eval não mede recall, stale/conflicted memory ou leakage |
| Waves 1–14 | Wave 15 | agents, sessions, events, evals, reliability, incidents, budgets | autonomy promove sem evidence, budget ou rollback |
| Wave 5/9/10 | Wave 15 | costs, builds, delivery, resource routes, health | otimização usa custo/status inventado ou bypass de release |

### 8.3 Regra de avanço

Cada Wave fornece output à seguinte apenas após gate provider-free verificável com comando, exit code, SHA/status, artifacts e evidence. Provider live, conta externa, RLS, Graphiti/Neo4j, embeddings, publicação, spend, deploy, produção e autonomy promotion são gates separados. Ausência de prova fica `NOT_PROVEN`/`BLOCKED_EXTERNAL`; não avançar por receipt ou silêncio.

## 9. Gate transversal de aceitação

Classificar a fatia como `PASS_LOCAL` apenas quando existirem, no scope declarado:

- typecheck/schema validation;
- testes de state machine, tenant isolation, consent, namespace, idempotência, replay, locks e stale version;
- fixtures fake para providers, source/memory, eval, goals, budgets e routing;
- redaction/secret assertions e prompt injection/self-grant/cross-tenant negative tests;
- receipts/evidence ligados a cada ingestão, outbound, memory write, eval, goal cycle e promotion;
- Wave 11: consent, contact, conversation, webhook replay, outbound failure e relationship memory;
- Wave 12: provenance/freshness/confidence por claim/skill, content/video review e analytics evidence;
- Wave 13: Memory Gateway, Source Registry, Canon, Freshness, supersession e Graph projection rebuild;
- Wave 14: recall/freshness/isolation/permission/red-team/regression e reviewer/promotion separation;
- Wave 15: Goal Lite, watchdog de três ciclos, health, budgets, ResourceRouter e A0–A5 promotion/rollback;
- accessibility, privacy, security, incident/recovery e human approval como gates próprios;
- nenhum `PASS_LOCAL` confundido com provider, publicação, produção, dinheiro, cliente ou autonomia ativa.

## 10. Limites e bloqueios explícitos

Continuam `NOT_PROVEN` ou `BLOCKED_EXTERNAL` até prova autorizada:

- contas e APIs WhatsApp, Instagram, Facebook, Google, email e voice;
- assinatura/webhook, egress, secret proxy, rate limits e provider billing;
- source/licensing/legal/consent real, likeness e retention por jurisdição;
- Graphiti/Neo4j/Mem0/embeddings/crawler e qualidade universal de retrieval;
- produção, RLS/Postgres live, BrowserMesh, deploy, publicação, analytics real e storage/CDN;
- approval matrix final, thresholds de eval, autonomy values, budgets e resource policies;
- spend/ROI, provider routing, app/customer data e qualquer movimento financeiro;
- promoção real A0–A5, cliente pagante e first customer proof.

Na ausência de autorização, credencial ou evidence observável, registar uma única variável faltante e a ação necessária. Não imprimir, copiar, logar ou transportar secrets; não fazer download/instalação sem autorização explícita.

**Fecho documental:** Waves 11–15 reutilizam os contratos canónicos e Waves 3–10, preservam tenant/policy/evidence/receipt, são provider-free e fail-closed, e não criam runtime, Memory Gateway, scheduler, CRM ou Permission Engine paralelos.
