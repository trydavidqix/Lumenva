# Contratos Canónicos Wave 7–10 V1

**Estado:** `DRAFT_CANONICAL_SPEC`

**Data:** 2026-09-12

**Escopo:** contratos provider-free para Wave 7 — Studio Editor; Wave 8 — Asset Intelligence; Wave 9 — Product Factory Web; e Wave 10 — Mobile + Delivery.

**Base:** `scratch-council/PLANO-MESTRE-DEFINITIVO-2026-09-12.md`, secção 5 (Waves 7–10), invariantes constitucionais, secções 10, 13 e 14, [CONTRATOS-CANONICOS-V1.md](/Users/david/Desktop/CRM/scratch-council/contratos/CONTRATOS-CANONICOS-V1.md) e [CONTRATOS-WAVE3-6-V1.md](/Users/david/Desktop/CRM/scratch-council/contratos/CONTRATOS-WAVE3-6-V1.md).

Este documento é especificação de contratos, testes e dependências. Não prova runtime, provider, BrowserMesh live, RLS real, storage, deploy, produção, publicação, cliente pagante ou delivery real.

## 1. Padrão comum de evidência e autoridade

### 1.1 Invariantes

- `MODEL != AGENT`; `AGENT != PROCESS`.
- CRM/Command Center é o control plane; BrowserMesh é o execution plane; Postgres/event log é a fonte operacional de verdade.
- `organization_id` confiável + RLS é a fronteira de tenancy.
- O Permission/Approval Engine e o Action Bus são únicos; nenhuma Wave cria autorização, scheduler, CRM, Storage Gateway ou dispatch paralelo.
- A ordem de decisão permanece `tenant/RLS → entitlement → dependências/conflitos → role/capability → P0–P4 → risco → approval → action → receipt/evidence`.
- Autonomia não aumenta autoridade; `P4` nunca é autoexecutável; `intersect(parent, child)` nunca alarga envelope.
- Assets, prompts, código gerado, screenshots, metadata e conteúdo externo são dados não confiáveis até validação; não são instrução de prioridade superior.
- Segredos não entram em prompts, memória, evidence, logs, artefactos ou Git.
- Projections, manifests derivados, previews e bundles são reconstruíveis; nenhum substitui Postgres/event log.

### 1.2 Classificação e prova

Afirmações usam `FACT`, `ASSUMPTION`, `INFERENCE` ou `UNKNOWN`. Gates usam:

```text
PASS | FAIL | NOT_EXECUTED | NOT_PROVEN | BLOCKED_EXTERNAL
```

Timeout, silêncio, processo iniciado, receipt existente, preview renderizado ou HTTP 200 isolado não é `PASS`. `PASS_LOCAL` e `COMPLETED_LOCAL` limitam-se ao checkout/fixture/ambiente observado e não provam merge, deploy, provider, produção ou cliente real.

### 1.3 Envelope comum

```ts
type FactoryContext = {
  organization_id: string;
  actor_id: string;
  actor_type: "HUMAN" | "AGENT" | "SYSTEM" | "OWNER_GATEWAY";
  agent_id?: string;
  session_id?: string;
  task_id?: string;
  project_id?: string;
  request_id: string;
  correlation_id: string;
  policy_version: string;
  permission_level: "P0" | "P1" | "P2" | "P3" | "P4";
  risk_level: "R0" | "R1" | "R2" | "R3" | "R4";
  idempotency_key: string;
};
```

O boundary confiável resolve tenant, actor, capabilities, plan, RLS, policy e request ID. Browser, modelo, asset, código gerado ou cliente não pode escolher ou sobrescrever esses campos.

### 1.4 Receipts e evidence

Toda mutação `P2+`, geração de código/artefacto, publicação, dispatch, aprovação, alteração de manifest ou delivery produz receipt com tenant, actor/agent, task/project, policy/version, permission, risk, idempotency key, decisão, result, reviewer/approval quando exigido e evidence redigida.

Evidence deve conter timestamp, comando/observação, exit code quando aplicável, branch/SHA/worktree quando for código, artifact digest/ref, source refs, classificação e estado. Receipt liga a evidence, mas não a substitui.

## 2. Máquina de estados compartilhada

### 2.1 Execução e artefactos

```text
REQUESTED
  → VALIDATING
  → WAITING_APPROVAL
  → AUTHORIZED
  → QUEUED
  → DISPATCHED
  → RUNNING
  → CHECKPOINTED
  → VERIFIED
  → SUCCEEDED
```

Saídas explícitas:

```text
DENIED | FAILED | RETRYABLE | CANCELLED | EXPIRED
| BLOCKED_EXTERNAL | COMPENSATION_REQUIRED | COMPENSATED | NOT_PROVEN
```

`SUCCEEDED` requer artefacto/resultado, testes ou observação e evidence verificável. Um preview, bundle ou recibo sem verificação permanece `NOT_PROVEN`.

### 2.2 Idempotência, versões e reconstrução

- Toda entidade tem `contract_version`/`schema_version` e `policy_version`.
- A mesma `idempotency_key` devolve resultado/receipt determinístico; não cria variante, asset, build, release ou delivery duplicado.
- Retry só para erro explicitamente retryable, com limite de tentativas, timeout e budget.
- Event log, ProjectSpec, LayerManifest, BuildPlan, release manifest e delivery manifest são append-only/versionados; correção usa supersession/compensation, nunca apagamento silencioso.
- Qualquer projection, preview, cache ou bundle deve poder ser reconstruído a partir das fontes e manifests canónicos.

## 3. Wave 7 — Studio Editor

### 3.1 Objetivo e fronteira

Studio Editor acrescenta Canvas, AI edits e variant mixing sob `ContextPack`, authority e evals. O editor produz propostas/versionamentos e artefactos verificáveis; não publica, cobra, altera produção ou concede autoridade por si.

### 3.2 `CanvasDocument` e `ContextPack`

```ts
type CanvasDocument = {
  canvas_id: string;
  organization_id: string;
  project_id: string;
  version: number;
  parent_version?: number;
  viewport: { width: number; height: number; unit: "PX" | "PT" | "REM" };
  layers: LayerRef[];
  selected_variant_id?: string;
  editor_state: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SUPERSEDED";
  source_refs: string[];
  evidence_refs: string[];
  created_by: string;
  created_at: string;
};

type ContextPack = {
  context_pack_id: string;
  organization_id: string;
  project_id: string;
  purpose: "EDIT" | "MIX_VARIANT" | "REVIEW" | "PREVIEW";
  project_spec_version: string;
  allowed_assets: string[];
  allowed_sources: string[];
  constraints: string[];
  authority_envelope_ref: string;
  budget: { max_tokens: number; max_assets: number; max_latency_ms: number };
  provenance_refs: string[];
  redacted: boolean;
};
```

`ContextPack` é JIT, tenant/project-scoped, limitado e versionado. Itens fora do allowlist, source stale/revogada, segredo, PII não autorizada ou contexto acima do budget resultam em `DENY`/`NOT_PROVEN`.

### 3.3 `LayerRef` e AI edit

```ts
type LayerRef = {
  layer_id: string;
  asset_id?: string;
  semantic_role: string;
  bounds: { x: number; y: number; width: number; height: number };
  z_index: number;
  properties: Record<string, unknown>;
  source_refs: string[];
  locked: boolean;
};

type AIEditRequest = {
  edit_id: string;
  organization_id: string;
  project_id: string;
  canvas_id: string;
  base_version: number;
  context_pack_id: string;
  instruction: string;
  target_layer_ids: string[];
  permission_level: "P0" | "P1" | "P2" | "P3" | "P4";
  risk_level: "R0" | "R1" | "R2" | "R3" | "R4";
  idempotency_key: string;
  status: "REQUESTED" | "VALIDATING" | "DENIED" | "APPROVED" | "RUNNING" | "PREVIEW_READY" | "APPLIED" | "FAILED" | "CANCELLED";
  diff_ref?: string;
  eval_refs: string[];
};
```

```ts
type CanvasOperation = {
  operation_id: string;
  canvas_id: string;
  base_version: number;
  actor_id: string;
  operation_type: "ADD_LAYER" | "UPDATE_LAYER" | "REMOVE_LAYER" | "REORDER_LAYER" | "MIX_VARIANT";
  target_refs: string[];
  patch_redacted: unknown;
  authority_envelope_ref: string;
  idempotency_key: string;
  status: "REQUESTED" | "APPLIED" | "STALE_VERSION" | "DENIED" | "FAILED";
  receipt_id: string;
};

type EditorEvalRun = {
  eval_id: string;
  canvas_id: string;
  input_version: number;
  eval_version: string;
  checks: string[];
  metrics: Record<string, number | string | boolean>;
  status: "PASS" | "FAIL" | "NOT_EXECUTED" | "NOT_PROVEN";
  evidence_refs: string[];
};
```

AI edit não modifica versão aprovada diretamente. O fluxo é:

```text
base version → policy/context validation → proposed diff
→ preview/eval → human or policy approval → new canvas version
```

Prompt injection dentro de asset, texto do canvas ou source não muda policy, capability, tenant ou target layers. `locked=true` exige approval adicional para alterar.

### 3.4 Variant mixing

```ts
type VariantMix = {
  mix_id: string;
  project_id: string;
  input_variant_ids: string[];
  output_canvas_id: string;
  mix_rules: string[];
  context_pack_id: string;
  status: "DRAFT" | "PREVIEW" | "EVALUATED" | "APPROVED" | "REJECTED";
  source_refs: string[];
  evidence_refs: string[];
  receipt_id?: string;
};
```

Mix só combina variantes explicitamente autorizadas pelo `ProjectSpec`/`ContextPack`; não copia assets sem provenance nem sobrescreve seleção do cliente. Uma mistura aprovada é novo artefacto versionado, não mutação destrutiva.

### 3.5 Evals do Editor

Evals mínimos: integridade de layers, bounds válidos, ausência de assets proibidos, provenance completa, tenant isolation, policy/authority boundary, idempotência, regressão visual determinística, acessibilidade quando aplicável e redaction. Evals não concedem capability nem substituem approval.

### 3.6 Critérios de aceite provider-free da Wave 7

1. Canvas versionado reconstrói layers, source refs, evidence refs e parent version.
2. Dois tenants e dois projetos não cruzam canvas, context pack, variants ou assets.
3. AI edit com base stale recebe `STALE_VERSION`; replay não duplica diff nem nova versão.
4. Prompt injection em texto/asset não altera authority, target layer, policy ou tool scope.
5. ContextPack aplica allowlist, budget, freshness, provenance e redaction.
6. AI edit gera diff/preview/eval antes de aplicar e não altera versão aprovada sem approval.
7. Layer lock, P3/P4, asset sensível e alteração de escopo exigem approval apropriada; P4 nunca autoexecuta.
8. Variant mixing usa apenas inputs autorizados, mantém provenance e produz artefacto novo.
9. Falha, cancelamento, timeout, quota e retry deixam estado/retrieval/evidence explícitos.
10. Testes com adapter fake passam; modelos/providers/Canvas live e publicação permanecem `NOT_PROVEN` sem boundary autorizado.

## 4. Wave 8 — Asset Intelligence

### 4.1 Objetivo e fronteira

Asset Intelligence fornece Magic Layers, Reverse Design, `LayerManifest` e semantic specs com provenance. A análise pode descrever e estruturar um asset; não pode alegar autoria, licença, identidade, verdade visual ou permissão sem source/evidence.

### 4.2 `AssetRecord` e `LayerManifest`

```ts
type AssetRecord = {
  asset_id: string;
  organization_id: string;
  project_id?: string;
  content_hash: string;
  media_type: string;
  dimensions?: { width: number; height: number };
  storage_ref: string;
  source_refs: string[];
  consent_refs: string[];
  license_ref?: string;
  sensitivity: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "RESTRICTED";
  provenance_status: "UNKNOWN" | "PARTIAL" | "VERIFIED" | "REVOKED";
  status: "REGISTERED" | "ANALYZED" | "APPROVED" | "SUPERSEDED" | "DELETED_PENDING_RETENTION";
  created_at: string;
};

type LayerManifest = {
  manifest_id: string;
  asset_id: string;
  version: string;
  layers: SemanticLayer[];
  confidence: number;
  assumptions: string[];
  unknowns: string[];
  source_refs: string[];
  evidence_refs: string[];
  extractor_ref: string;
  status: "DRAFT" | "ANALYZED" | "VERIFIED" | "SUPERSEDED" | "REJECTED";
};

type SemanticLayer = {
  layer_id: string;
  role: string;
  geometry: Record<string, number>;
  visual_properties: Record<string, unknown>;
  child_layer_ids: string[];
  confidence: number;
  provenance_refs: string[];
};
```

### 4.3 Magic Layers e Reverse Design

```ts
type AssetAnalysis = {
  analysis_id: string;
  asset_id: string;
  operation: "MAGIC_LAYERS" | "REVERSE_DESIGN" | "SEMANTIC_SPEC";
  input_hash: string;
  manifest_id?: string;
  semantic_spec_ref?: string;
  status: "REQUESTED" | "RUNNING" | "PREVIEW_READY" | "VERIFIED" | "FAILED" | "BLOCKED_EXTERNAL";
  assumptions: string[];
  unknowns: string[];
  eval_refs: string[];
  receipt_id: string;
};
```

`MAGIC_LAYERS` identifica camadas sem prometer separação perfeita; `REVERSE_DESIGN` produz hipótese estrutural e visual, não cópia legalmente autorizada; `SEMANTIC_SPEC` descreve regras/estrutura com confiança, assumptions e unknowns. Conteúdo externo é não confiável e não injeta instrução.

### 4.4 Provenance, hash e retenção

- `content_hash` e versão impedem confundir asset alterado com asset original.
- Asset com license/consent ausente ou revogado pode ser analisado em modo limitado, mas não publicado/entregue como aprovado.
- Redaction e minimização aplicam-se a previews/evidence; secrets e tokens nunca são incorporados ao asset.
- Retenção, apagamento e direitos do cliente são policy/owner decisions; apagar referência canónica sem autorização é proibido.

### 4.5 Critérios de aceite provider-free da Wave 8

1. Dois tenants não conseguem enumerar ou recuperar assets, manifests ou previews do outro.
2. Hash/version detectam input alterado e impedem replay como se fosse o original.
3. LayerManifest contém layers, hierarquia, geometry, confidence, assumptions, unknowns e provenance.
4. Source/licença/consent ausente fica `UNKNOWN`/`NOT_PROVEN` e bloqueia aprovação/publicação.
5. Magic Layers e Reverse Design são reexecutáveis com a mesma input hash e idempotency key.
6. Prompt injection em imagem, metadata, OCR ou alt text não altera policy, tool scope ou authority.
7. Asset sensível usa redaction e não aparece em evidence fora do scope.
8. Supersession preserva histórico; análise nova não apaga manifest anterior.
9. Evals detectam geometry inválida, layer órfã, confidence ausente, provenance quebrada e cross-tenant leakage.
10. Modelo de visão, storage provider, CDN e publicação real permanecem `NOT_PROVEN` quando não executados.

## 5. Wave 9 — Product Factory Web

### 5.1 Objetivo e fronteira

Product Factory Web recebe um `BuildPlan`, gera artefactos isolados, executa Repair Loop, preview, testes e release. Dispatch é isolado e não pode escrever em `main`, produção, credenciais ou repositório fora do scope.

### 5.2 `BuildPlan`

```ts
type BuildPlan = {
  build_plan_id: string;
  organization_id: string;
  project_id: string;
  source_spec_refs: string[];
  asset_manifest_refs: string[];
  target_repo_ref: string;
  target_branch: string;
  base_sha: string;
  allowed_paths: string[];
  forbidden_paths: string[];
  commands: string[];
  test_commands: string[];
  acceptance_criteria: string[];
  budget_ref?: string;
  authority_envelope_ref: string;
  status: "DRAFT" | "VALIDATED" | "AUTHORIZED" | "QUEUED" | "RUNNING" | "PREVIEW" | "TESTING" | "RELEASE_CANDIDATE" | "RELEASED" | "FAILED" | "CANCELLED" | "BLOCKED_EXTERNAL";
  idempotency_key: string;
};
```

BuildPlan DEVE fixar base SHA, branch/worktree, allowlist/denylist de paths, commands, testes, budget, owner, policy, risk e critérios. `target_repo_ref` não pode apontar para produção protegida sem P4 e autorização própria.

### 5.3 Geradores e artefactos

```ts
type GeneratedArtifact = {
  artifact_id: string;
  build_plan_id: string;
  organization_id: string;
  path: string;
  content_hash: string;
  generator_ref: string;
  source_refs: string[];
  status: "CREATED" | "CHECKED" | "REJECTED" | "SUPERSEDED";
};

type BuildResult = {
  build_id: string;
  build_plan_id: string;
  base_sha: string;
  output_sha?: string;
  worktree_ref: string;
  exit_code?: number;
  test_results: TestResult[];
  artifact_refs: string[];
  evidence_refs: string[];
  status: "PASS_LOCAL" | "FAIL" | "NOT_EXECUTED" | "NOT_PROVEN" | "BLOCKED_EXTERNAL";
};

type GeneratorRun = {
  generator_run_id: string;
  build_plan_id: string;
  generator_ref: string;
  input_hashes: string[];
  worktree_ref: string;
  command_ref: string;
  output_artifact_refs: string[];
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  receipt_id: string;
};

type TestReport = {
  report_id: string;
  build_id: string;
  suite_version: string;
  commands: string[];
  exit_codes: number[];
  quality: Record<string, number | string | boolean>;
  known_failures: string[];
  accessibility_refs: string[];
  security_refs: string[];
  status: "PASS" | "FAIL" | "NOT_EXECUTED" | "NOT_PROVEN";
  evidence_refs: string[];
};
```

Gerador só escreve paths autorizados no worktree isolado. Código gerado é untrusted até typecheck/test/lint/security gates. `PASS_LOCAL` não equivale a merge, deploy ou release live.

### 5.4 Repair Loop

```text
preview → test → failure classification → bounded repair
→ re-test → max attempts/budget → release candidate ou BLOCKED
```

Repair só pode modificar paths/artefactos do BuildPlan, registra diff, attempt, causa, command, exit code e receipt, e para após limite. Não pode mascarar teste, reduzir coverage, remover policy/security gate ou alterar acceptance criteria sem nova aprovação.

### 5.5 Preview, testes e release

- Preview é artefacto isolado, versionado e redigido; não é deployment.
- Testes devem incluir typecheck, unit/integration relevantes, lint/build declarado, security/tenant isolation e acessibilidade quando UI.
- Release candidate exige base SHA, output SHA/digest, testes e evidence verificáveis.
- `RELEASED` neste contrato significa artefacto local autorizado; publicação/deploy continua estado posterior e separado.
- Qualquer falha ou teste não executado permanece visível; não converter em sucesso por screenshot ou servidor iniciado.

### 5.6 Critérios de aceite provider-free da Wave 9

1. BuildPlan com base SHA, allowlist/denylist, worktree, commands, testes e acceptance criteria é validado antes de executar.
2. Dois tenants não cruzam BuildPlans, artefactos, logs ou previews.
3. Gerador não escreve fora de paths autorizados nem em `main`/produção.
4. Replay do BuildPlan é idempotente e não duplica release/artifact.
5. Repair Loop tem limite de attempts/time/budget, preserva diff e não altera gates para obter verde.
6. Failure classification diferencia `FAIL`, `NOT_EXECUTED`, `NOT_PROVEN` e `BLOCKED_EXTERNAL`.
7. Preview reproduzível liga source, asset manifest, output hash, tests, receipts e evidence.
8. Teste de prompt injection em spec/asset/código gerado não concede capability nem altera allowed paths.
9. Cancelamento, timeout, crash e worker duplicado deixam estado recuperável e sem side effect fora do worktree.
10. Merge, push, deploy, provider live e release público permanecem `NOT_PROVEN` sem gate autorizado.

## 6. Wave 10 — Mobile + Delivery

### 6.1 Objetivo e limite

Wave 10 entrega artefactos web/mobile e serviço gerido usando os mesmos contratos de tenant, policy, evidence, receipt e estado. Não inventa schema de autorização, não cria app paralelo e não considera distribuição/publicação automática como consequência de um build local.

### 6.2 `DeliveryPlan` e `DeliveryArtifact`

```ts
type DeliveryPlan = {
  delivery_plan_id: string;
  organization_id: string;
  project_id: string;
  build_ref: string;
  channels: ("WEB_PREVIEW" | "MOBILE_PREVIEW" | "APP_STORE" | "PLAY_STORE" | "MANAGED_SERVICE")[];
  environment: "LOCAL" | "STAGING" | "PRODUCTION";
  release_policy_version: string;
  rollout: "NONE" | "INTERNAL" | "PERCENTAGE" | "FULL";
  rollback_ref?: string;
  support_owner: string;
  acceptance_criteria: string[];
  status: "DRAFT" | "VALIDATED" | "APPROVED" | "PACKAGED" | "DELIVERED" | "ROLLED_BACK" | "FAILED" | "BLOCKED_EXTERNAL";
};

type DeliveryArtifact = {
  delivery_artifact_id: string;
  delivery_plan_id: string;
  artifact_ref: string;
  content_hash: string;
  platform?: "WEB" | "IOS" | "ANDROID";
  version: string;
  provenance_refs: string[];
  security_scan_refs: string[];
  test_refs: string[];
  status: "BUILT" | "VERIFIED" | "APPROVED" | "DELIVERED" | "REVOKED";
};

type MobileReleaseCandidate = {
  candidate_id: string;
  delivery_plan_id: string;
  platform: "IOS" | "ANDROID" | "WEB";
  package_ref: string;
  source_sha: string;
  signing_status: "UNSIGNED" | "SIGNED_VERIFIED" | "NOT_PROVEN";
  test_refs: string[];
  accessibility_refs: string[];
  security_refs: string[];
  rollback_ref?: string;
  status: "DRAFT" | "TESTING" | "APPROVED" | "SUBMITTED" | "RELEASED" | "REVOKED";
};
```

Production, app store, domain, signing keys, distribution account e customer support são boundaries externos. `APPROVED`/`DELIVERED` no ledger local não prova publicação ou disponibilidade pública sem evidence própria.

### 6.3 Mobile contract

Mobile usa as mesmas APIs internas e gates de tenant; client-side state/cache é não canónico. Offline/sync, quando autorizado, usa mutation IDs, versionamento e reconciliação determinística; conflito não é resolvido por last-write silencioso.

Requisitos mínimos: safe-area/responsive layouts, loading/empty/error/recovery, redaction de PII, session expiry/revocation, deep links escopados, storage local sem secrets duradouros, acessibilidade WCAG 2.2 quando web e critérios de plataforma quando mobile.

### 6.4 Managed delivery e suporte

```ts
type DeliveryReceipt = {
  delivery_receipt_id: string;
  delivery_plan_id: string;
  organization_id: string;
  artifact_refs: string[];
  environment: string;
  actor_id: string;
  approval_id?: string;
  result: "HANDED_OFF" | "AVAILABLE" | "ROLLED_BACK" | "FAILED" | "NOT_PROVEN";
  support_ticket_ref?: string;
  evidence_refs: string[];
  created_at: string;
};

type DeliveryHandoff = {
  handoff_id: string;
  delivery_plan_id: string;
  recipient_ref: string;
  artifact_refs: string[];
  acceptance_criteria: string[];
  token_id?: string;
  occurred_at: string;
  acknowledgement_status: "PENDING" | "ACKNOWLEDGED" | "CHANGES_REQUESTED" | "REJECTED";
  evidence_refs: string[];
};
```

Entrega gerida exige hand-off, URL/artefacto autorizado, aceite/acknowledgement e suporte básico registados. Falha de delivery deixa rollback/compensation e ticket; não declarar cliente entregue por build ou link não verificado.

### 6.5 Critérios de aceite provider-free da Wave 10

1. DeliveryPlan só referencia build/artefacto com hash, source, tests e policy válidos.
2. Dois tenants não atravessam artifacts, preview, delivery plan, support ticket ou receipt.
3. Ambiente `LOCAL`, `STAGING` e `PRODUCTION` é explícito; teste local não é prova de produção.
4. Repetição de packaging/delivery com a mesma idempotency key não duplica hand-off.
5. Rollback usa artifact conhecido e receipt/evidence; não apaga histórico.
6. Mobile/web session expiry, revoked device/token, offline conflict e recovery produzem estados observáveis.
7. PII, signing material, secrets e tokens nunca entram em bundle, logs ou evidence redigida.
8. Support hand-off inclui owner, next step, acceptance/ack e ticket quando aplicável.
9. A11y, security scan, tests e preview são gates separados; ausência fica `NOT_EXECUTED`/`NOT_PROVEN`.
10. App Store/Play Store, CDN, domínio, push, billing, produção e cliente real permanecem `NOT_PROVEN` sem prova autorizada.

## 7. Dependências entre Waves 7–10

### 7.1 Grafo canónico

```text
Waves 1–6: tenant/policy/agent/event/source/evidence/receipt
                 ↓
Wave 7 Studio Editor: Canvas + ContextPack + AI edits + variants
                 ↓
Wave 8 Asset Intelligence: AssetRecord + LayerManifest + semantic specs
                 ↓
Wave 9 Product Factory Web: BuildPlan + generators + Repair Loop + preview/tests/release
                 ↓
Wave 10 Mobile + Delivery: packaging + rollout/rollback + hand-off/support
```

### 7.2 Dependências detalhadas

| Origem | Destino | Contrato consumido | Falha se ausente |
|---|---|---|---|
| Waves 1–6 | Wave 7 | ProjectSpec, client decision, context, policy, approval, source/evidence | edit fora do projeto, variant sem approval ou contexto não auditável |
| Wave 7 | Wave 8 | Canvas layers, allowed assets, project scope, variant refs | análise sem input/version/provenance ou mix inválido |
| Wave 8 | Wave 7/9 | AssetRecord, LayerManifest, semantic spec, hashes, license/consent | editor/factory usa asset stale, proibido ou sem origem |
| Wave 7–8 | Wave 9 | Canvas/semantic specs, asset manifests, acceptance criteria | BuildPlan incompleto ou código sem source/evidence |
| Waves 1–8 | Wave 9 | tenant, policy, ActionBus, worktree, locks, tests, receipts | dispatch paralelo, escrita fora do scope ou repair infinito |
| Wave 9 | Wave 10 | output SHA/digest, test/security/a11y evidence, release candidate | delivery sem artefacto verificável ou rollback |
| Waves 1–9 | Wave 10 | tenant, policy, consent, support owner, delivery receipt | cliente/produção confundidos com local build |

### 7.3 Regra de avanço

Uma Wave só fornece input à seguinte após gate provider-free verificável com comando, exit code, SHA/status, artefacto e evidence. Provider, storage/CDN, BrowserMesh live, RLS, app stores, domínio, deploy, produção e cliente real são gates independentes. Falta de prova fica `NOT_PROVEN`/`BLOCKED_EXTERNAL`; não avançar por silêncio.

## 8. Gate transversal de aceitação

Classificar a fatia como `PASS` apenas no scope declarado quando existirem:

- typecheck dos schemas e interfaces;
- testes de estados, versionamento e transições inválidas;
- isolamento de dois tenants, dois projetos e dois artefactos;
- matriz P0–P4 × R0–R4 × A0–A5/L0–L4;
- idempotência, replay, lock/lease e concorrência;
- provenance, hash, redaction, license/consent e source freshness;
- prompt injection/self-grant/secret extraction a falhar closed;
- receipt/evidence com FACT/ASSUMPTION/INFERENCE/UNKNOWN e gate status;
- Wave 7: edit com diff/preview/eval, ContextPack e variant mixing;
- Wave 8: Magic Layers/Reverse Design/LayerManifest semanticamente rastreáveis;
- Wave 9: BuildPlan isolado, Repair Loop bounded, preview, testes e release candidate;
- Wave 10: package, rollout/rollback, hand-off, support e delivery receipt;
- acessibilidade, security e recovery como gates separados;
- confirmação de que `PASS_LOCAL` não é merge, deploy, provider, produção, publicação ou cliente pagante.

## 9. Limites e bloqueios explícitos

Continuam `NOT_PROVEN` ou `BLOCKED_EXTERNAL` até prova própria:

- Canvas/asset/model providers live, storage, CDN e OCR/vision externos;
- BrowserMesh real, worker/dispatch live e RLS/Postgres no checkout/runtime alvo;
- geração de código em repositório real, merge, push, deploy e release público;
- signing keys, App Store/Play Store, domínio, notificações push e contas de distribuição;
- approval matrix final, budgets, licensing/consent legal, retenção e suporte contratual;
- cliente real, pagamento, hand-off externo, disponibilidade pública e first customer proof.

Na ausência de autorização, credencial ou evidência observável, registar apenas a variável faltante e a ação necessária. Não imprimir, copiar, logar ou transportar secrets; não fazer download/instalação sem autorização explícita.

**Fecho documental:** Waves 7–10 reutilizam os contratos canónicos e Wave 3–6, preservam tenant/policy/evidence/receipt, são provider-free e fail-closed, e não criam plataforma paralela.
