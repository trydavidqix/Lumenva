# Conformidade Wave 3 V1 — Session-Aware Runtime

**Data da revisão:** 2026-09-12

**Escopo:** revisão cruzada read-only dos commits reais atribuídos a Fornalha e Lótus contra `scratch-council/contratos/CONTRATOS-WAVE3-6-V1.md`, secção Wave 3.

**Veredito global:** `FAIL — CONFORMIDADE PARCIAL; NÃO PROMOVER`

Os commits cobrem superfícies importantes e alguns testes provider-free, mas não implementam o Wave 3 completo. Há divergências materiais entre o contrato e o código: `SessionService` continua apenas uma superfície de tipos; `MemoryGate` não recebe tenant/policy/provenance/expiry/redaction; `ContextCompiler` não produz o `ContextPackage` canónico; e ToolLoopLock ainda depende de persistência atómica externa para provar o requisito de concorrência.

## 1. Limite de evidência

### 1.1 Checkout e SHAs verificados

Inspeção read-only no worker Linux `claude@192.168.1.78`, via `~/.ssh/lumenva_worker`.

| Item | Evidência observada |
|---|---|
| Worktree Fornalha | `/home/claude/src/worktrees/wave3-session-runtime-skeleton-2026-09-12` |
| Branch | `wave3/session-runtime-skeleton-2026-09-12` |
| HEAD observado | `8d1e12e8b3a0bd712a961460753afab6e7c6a191` |
| Session Service skeleton | `f7547c5ae812ac73eab08075032844db014db35c` |
| Fornalha — ToolLoopLock | `0f4dea20823a117a29c577e5c1775cab17ea59f3` |
| Fornalha — Memory Gate | `a371c914e9f8e57206df53c043b9a1c040c2b0f9` |
| Worktree Lótus | `/home/claude/src/worktrees/memory-context-compiler-2026-09-12` |
| Branch Lótus | `memory-kernel/context-compiler-2026-09-12` |
| Lótus — dedup/supersession | `e29d1568ca6080968451df6a34f4900597fce3c3` |

### 1.2 Arquivos e comandos de leitura

- Fornalha: `apps/crm/lib/agent-engine/session/session-service.ts` e `tool-loop-lock.test.ts` no commit `0f4dea20`/HEAD do worktree.
- Fornalha: `apps/crm/lib/agent-engine/session/memory-gate.ts` e `memory-gate.test.ts` no commit `a371c914`.
- Lótus: `apps/crm/lib/memory/context-compiler.ts`, `supersession.ts` e `supersession.test.ts` no commit `e29d1568`.
- Comandos de verificação: `git rev-parse`, `git branch --show-current`, `git status --short --branch`, `git show`, `git diff-tree`, `nl -ba` e `git worktree list --porcelain` executados por SSH.

### 1.3 Fronteira de prova

Não foram executados build, typecheck, Vitest, persistência Postgres, RLS, worker concorrente, provider, deploy, migration ou produção nesta revisão. Portanto, qualquer gate de execução é `NOT_EXECUTED`/`NOT_PROVEN`, mesmo quando existe teste no commit.

## 2. Contrato de referência auditado

O contrato Wave 3 exige:

1. `SessionService` com `create`, `load`, `checkpoint`, `resume`, `compact`, `handoff` e `cancel`, todos idempotentes e tenant-scoped.
2. `SessionState` com `organization_id`, `agent_id`/versão, `execution_epoch`, `state_version`, goal, constraints, facts, decisions, promises, completed, pending, artifacts, errors, blockers, verification, next action, locks e budget.
3. `ModelLock`/`ToolLoopLock` com epoch, expiração, exclusão de concorrência, release correto e receipt/evidence em pausa/falha.
4. `ContextPackage` com identity, goal, memory, knowledge, session, tool state, budget, trust metadata, source refs e redaction.
5. `MemoryGate` fail-closed para tenant errado, namespace indevido, segredo, item expirado, provenance ausente, redaction inválida, stale/conflicted item e budget excedido.
6. Handoff normalizado preservando goal, constraints, facts, decisions, promises, completed, pending, artifacts, errors, blockers, verification e next action.
7. Quotas, Pulse e Dispatch Router com estado observável, lease/deadline, no-progress após três ciclos e dispatch sem bypass.
8. Critérios B4: `Session State Loss = 0`, `Tool Duplicate Rate = 0`, `Unsafe Normal Handoff = 0`, `Tenant Leakage = 0`, `Tool Loop Continuity = 100%`, `Handoff Continuity ≥95%`, `Identity Consistency ≥95%` e `Structured Output ≥99%`.

## 3. Matriz de conformidade

| Área do contrato | Implementação observada | Estado | Divergência/limite |
|---|---|---|---|
| SessionState | Tipos com os campos principais e `SessionSnapshot` | `PASS PARCIAL` | Shape aproxima o contrato; não prova persistência, event log, snapshot reconstruível, RLS ou transitions. |
| SessionService API | Interface declara `create/load/checkpoint/resume/compact/handoff/cancel` | `NOT_PROVEN` | O arquivo declara que contém apenas types; não existe implementação runtime, store, event log, retry, cancelamento ou receipt. |
| `execution_epoch`/`state_version` | Campos e `expected_state_version` existem | `PASS DECLARATIVO` | Enforcement de optimistic concurrency não foi implementado nem executado. |
| ModelLock | Tipo com model, adapter, agent version, epoch e expiry | `PASS DECLARATIVO` | Não há Model Router, lock acquisition, provider swap, validation ou resume. |
| ToolLoopLock — epoch/expiry | `assertLiveToolLoopLock()` valida epoch opcional, expiry inválida e expirada | `PASS PARCIAL` | Testes existentes cobrem os erros declarados; não foram executados nesta revisão. |
| ToolLoopLock — ocupação/limite/ownership | `claim` rejeita busy/max; `complete` exige active call igual | `PASS PARCIAL` | A função pura devolve cópia; segurança concorrente depende do caller/store. |
| ToolLoopLock — CAS local | `ToolLoopLockStore` faz compare-and-swap por identidade em seção síncrona | `PASS LOCAL LIMITADO` | Não prova store multi-worker, transação ou CAS no persistence layer real. Requisito “dois workers” continua `NOT_PROVEN`. |
| ToolLoopLock — pause/receipt | Erros são lançados (`LOCK_EXPIRED`, etc.) | `FAIL` | Contrato exige pausa de sessão e receipt/evidence; helper não altera SessionState nem emite receipt/evidence. |
| MemoryGate — fail-closed básico | Nega null, tipos malformados, strings vazias, NaN/infinito/autoridade negativa, owner/scope incompatíveis | `PASS PARCIAL` | Falha fechada nos parâmetros testados. |
| MemoryGate — boundary canónico | Entrada é somente `{owner, scope, authority}` e policy igual | `FAIL` | Não valida `organization_id`, actor/capability, policy version, namespace permitido, provenance, expiry, redaction, privacy, lifecycle, idempotency ou budget. |
| ContextPackage shape | Lótus produz package com organization, subject, scope, memory, knowledge, budget, trust metadata, timestamps | `FAIL` | Faltam identity, goal, session items, tool state, source refs e `redacted` exigidos pelo contrato. |
| Context JIT/budget | Filtra org/subject/scope, lifecycle active, expiry e token budget | `PASS PARCIAL` | Budget de tokens existe; não há `max_items`/latência, limite 3–8, provenance/freshness/confidence gate ou redaction. |
| Context ranking | Ordena authority, confidence, observedAt e recordId | `PASS PARCIAL` | Ranking não valida provenance, source authority, freshness policy ou trust metadata por item. |
| Context expiry | Package usa `expiresAt = input.now` | `FAIL` | Expiry coincide com `generatedAt` por default; não existe TTL/policy de validade futura. |
| Context knowledge | `knowledge` é filtro de `selected` por `kind === "KNOWLEDGE"` | `FAIL PARCIAL` | Não há separação de identity/goal/memory/knowledge/session/tool state nem source/evidence refs. |
| Namespace isolation | Compiler exige igualdade exata de org/subject/scope | `PASS PARCIAL` | Ajuda no isolamento lógico; owner/home/company e boundary de actor não são modelados/verificados. |
| Supersession | `resolveSupersession()` rejeita org/subject/scope diferentes e escolhe observedAt/confidence | `PASS PARCIAL` | Cálculo puro e clones preservam input; não grava atomically o vencedor nem marca persistido o perdedor. |
| Supersession malformed input | Não valida record IDs/timestamps/confidence em `resolveSupersession()` | `FAIL PARCIAL` | Dados malformados podem ser ordenados; falta DENY/estado explícito para input inválido. |
| Handoff | Nenhum HandoffPack/runtime no conjunto auditado | `NOT_EXECUTED` | Contrato exige normalize → freeze/checkpoint → handoff → fallback → validation → new lock → resume. Não implementado nestes commits. |
| Quota/Pulse/Dispatch | Nenhuma implementação nos commits auditados | `NOT_EXECUTED` | Componentes Wave 3 continuam sem evidência de implementação. |
| Receipts/evidence | Tipos declaram receipt-related fields em Session; helpers não emitem receipt | `FAIL` | Contrato exige receipt/evidence para P2+, locks, falhas e ações; não há pipeline de receipt/evidence. |
| Adapters Mock/Gemini/Groq/Claude | Nenhum adapter implementado nos commits auditados | `NOT_EXECUTED` | Provider-free Mock e interfaces externas não foram provados. |

## 4. Divergências materiais

### D1 — SessionService é contrato de tipos, não runtime

**Evidência:** `session-service.ts:1-7` declara explicitamente que persistência, optimistic concurrency e idempotency pertencem à camada futura. `SessionService` em `:126-134` apenas declara assinaturas.

**Impacto:** o gate do contrato para `create/load/checkpoint/resume/compact/handoff/cancel`, tenant scope, snapshots, event log, replay, cancelamento, retry e estados observáveis não fecha.

**Estado:** `FAIL` para conformidade de implementação; `NOT_PROVEN` para runtime.

### D2 — ToolLoopLock tem implementação local, mas não prova concorrência real

**Evidência:** `session-service.ts:176-212` calcula e devolve cópia; `:219-267` fornece `ToolLoopLockStore` com CAS síncrono em `Map` e comentário “atomically in the caller's lock store”.

**Conforme:** epoch, expiry, busy, max iteration, ownership e stale call têm erros explícitos; os testes do commit cobrem epoch obsoleto, ocupado, expiração e limite segundo o diff observado.

**Divergência:** o contrato exige que dois workers não executem o mesmo call e que lock expirado pause sessão com receipt/evidence. O código não integra store persistente/multi-worker, não faz fencing transacional e não altera sessão/emite evidence quando lança erro.

**Estado:** `PASS LOCAL LIMITADO`; requisito completo `NOT_PROVEN`/`FAIL` até integração atómica e verificação concorrente.

### D3 — MemoryGate não implementa o boundary canónico

**Evidência:** `memory-gate.ts:3-13` só define `owner`, `scope`, `authority`; `:22-52` compara esses campos e usa threshold numérico.

**Conforme:** ausência/malformed/autoridade inválida resulta em `DENY`; owner/scope divergentes resultam em `DENY`.

**Divergência:** o contrato Wave 3 exige tenant/namespace, segredo, expiração, provenance, redaction, stale/conflicted item, budget e boundary de actor/policy. Nenhum desses campos existe no commit. Owner/scope/authority são strings/número fornecidos ao gate; não há autenticação nem resolução de capability.

**Estado:** `FAIL` para conformidade integral; `PASS PARCIAL` somente para fail-closed local.

### D4 — ContextCompiler não produz o `ContextPackage` contratado

**Evidência:** `context-compiler.ts:38-51` omite `identity`, `goal`, session state, tool state, source refs e redacted. `:76-99` filtra apenas `organizationId`, subject, scope, lifecycle active, validUntil e token budget. `:102-114` define `expiresAt` igual a `input.now`.

**Divergência:** faltam provenance/freshness/confidence/trust por item, limite 3–8 chunks, redaction, source/evidence refs, namespaces owner/home/company, identity/goal/session/tool state e expiry policy.

**Estado:** `FAIL` contra o contrato Wave 3; a filtragem básica de tenant/scope/expiry é apenas parcial.

### D5 — Dedup/supersession é decisão pura, não persistência atómica

**Evidência:** `supersession.ts:12-30` retorna clones `current`/`superseded`; não recebe repository, version, idempotency key ou transação.

**Conforme:** namespace mismatch gera erro; seleção é determinística por `observedAt`, `confidence` e a entrada permanece intacta nos testes.

**Divergência:** o contrato exige supersession preservada, replay idempotente, histórico e projeção reconstruível. Sem CAS/transação, duas chamadas podem escolher/escrever vencedores conflitantes; timestamps/IDs/confidence não são validados.

**Estado:** `PASS PARCIAL` para resolução pura; persistência/replay `NOT_PROVEN` e risco de corrida aberto.

## 5. Critérios de aceite comparados

| Critério Wave 3 | Veredito desta revisão |
|---|---|
| MockAdapter reproduz sessão completa com snapshot/state_version | `NOT_EXECUTED` — não há adapter/runtime nos commits auditados |
| Troca de adapter/modelo preserva identidade | `NOT_EXECUTED` |
| Stale write falha e replay não duplica tool | `NOT_PROVEN` — tipos/códigos existem, sem implementation/persistência executada |
| ToolLoopLock impede dois workers e max_iterations | `PASS LOCAL LIMITADO` para pure helper/store; `NOT_PROVEN` multi-worker |
| Handoff preserva campos e `Unsafe Normal Handoff = 0` | `NOT_EXECUTED` |
| Métricas B4 | `NOT_EXECUTED` — nenhum benchmark/execução foi rodado |
| ContextCompiler JIT 3–8, provenance/freshness/trust/budget | `FAIL` — implementação não carrega esses campos/limites |
| MemoryGate fail-closed completo | `FAIL PARCIAL` — só owner/scope/authority local |
| Quota/cancel/timeout/provider failure/retry com estado e receipt | `NOT_EXECUTED` |
| DispatchRouter com decisão equivalente sem bypass | `NOT_EXECUTED` |
| Crash/rebuild por event log + snapshot | `NOT_EXECUTED` |

## 6. Veredito e ações necessárias

### 6.1 Veredito

`FAIL — NÃO CONFORME PARA PROMOÇÃO DA WAVE 3`.

Há conformidade declarativa e local em partes de SessionState, ToolLoopLock e MemoryGate, mas a implementação real observada não fecha o contrato Session-Aware Runtime. O resultado correto é `PASS LOCAL LIMITADO` apenas para os helpers/tests estáticos delimitados; Wave 3 integrada permanece `NOT_PROVEN` e possui divergências `FAIL` no ContextPackage/MemoryGate e ausência de runtime SessionService/Handoff/Quota/Pulse/Dispatch.

### 6.2 Correções mínimas antes de novo gate

1. Implementar SessionService real com persistence/event log/snapshots, tenant check, optimistic concurrency/CAS, idempotency, transitions e receipts/evidence para `create/load/checkpoint/resume/compact/handoff/cancel`.
2. Integrar ToolLoopLock a store atómico/multi-worker com fencing por `execution_epoch`, teste de race e transição de sessão/receipt em expiry/failure.
3. Expandir MemoryGate para `organization_id`, namespace allowlist, actor/capability/policy version, provenance, freshness/expiry, privacy/redaction, lifecycle, budget e idempotency; continuar fail-closed.
4. Corrigir ContextCompiler para o shape canónico: identity, goal, memory, knowledge, session, tool state, budget, trust, source refs, redaction e expiry policy; validar limite 3–8 quando aplicável.
5. Implementar supersession/dedup no repository com transação/CAS, validação de IDs/timestamps/confidence, replay idempotente e reconstrução de projection.
6. Implementar/ligar MockAdapter, Model Router/Lock, HandoffPack, QuotaService, Pulse e DispatchRouter provider-free antes de qualquer claim de Wave 3.
7. Executar typecheck, testes declarados, concorrência/race, isolamento de dois tenants, redaction, replay, handoff e métricas B4 no SHA final; preservar exit codes e artifacts redigidos.

### 6.3 Limites que permanecem externos

Gemini/Groq/Claude live, provider credentials, RLS real, Postgres live, BrowserMesh, deploy, produção e promoção de autonomia não são fechados por estes commits. Continuam `NOT_PROVEN`/`BLOCKED_EXTERNAL` até gate próprio.

**SELF-CHECK:** PASS — inspeção read-only, SHAs e worktrees verificados por SSH, divergências ligadas a ficheiros/linhas, sem merge, sem alteração do worker, sem build/teste pesado e sem claim de runtime não observado.
