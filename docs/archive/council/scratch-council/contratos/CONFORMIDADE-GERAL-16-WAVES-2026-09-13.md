# Conformidade geral — 16 Waves

**Data da fotografia:** 2026-09-13  
**Escopo:** raio-x do código real existente nas worktrees das Waves 1–16, cruzado com os contratos canónicos e com os relatórios de segurança em `scratch-council/security/`.  
**Veredito global:** `NOT_PROVEN` para produção. Existem peças reais em todas as 16 Waves, mas nenhuma evidência reunida aqui demonstra o conjunto necessário de merge, testes completos, persistência real, RLS, provider, deploy, operação ou cliente real.

## 1. Como contar e como interpretar

### 1.1 Unidade de contagem

“Peça de código” significa um módulo de produção (`.ts`, `.tsx`, `.js`, `.jsx`, `.py` ou `.sql`) no branch/worktree mais específico observado para a Wave. Testes, documentação, `package.json` e lockfiles não entram na contagem. Quando uma Wave tem mais de uma implementação relacionada, os módulos são listados para tornar a contagem auditável.

Os branches abaixo são superfícies de trabalho do worker; não são prova de que os commits estejam em `main` ou em produção. A fotografia de `main` no worker era `17411bba65e737ce2ec6cc4bb4f338ebe92d29c9`.

### 1.2 Estados usados

- `PASS`: o relatório de segurança confirmou o critério revisto e não há ressalva crítica conhecida naquele escopo.
- `PASS-CONDICIONAL`: há comportamento local útil, mas falta integração, enforcement, cobertura ou revisão do SHA final.
- `BLOCKED`: há falha explícita ou condição que impede promoção; o código não deve ser tratado como pronto.
- `NOT_PROVEN`: código existe, mas não há evidência suficiente para afirmar o critério; ausência de relatório não é aprovação.

`PASS` neste documento nunca significa produção. `PASS-CONDICIONAL`, `BLOCKED` e `NOT_PROVEN` são estados deliberadamente conservadores.

### 1.3 Limite da revisão de segurança

Os relatórios Baluarte disponíveis são predominantemente inspeções estáticas read-only. Em vários casos revisam um commit anterior ao último fix da worktree. Quando o fix posterior não tem nova revisão, o achado anterior continua `BLOCKED` ou, no mínimo, `NOT_PROVEN`; não foi promovido por inferência.

## 2. Matriz executiva

| Wave | Código de produção | Branch/worktree observado / SHA | Revisão Baluarte | Estado real | Principal distância até produção |
|---|---:|---|---|---|---|
| 1 — Operating Core | 13 | `business-os/wave-1-operating-core` @ `f678e654` | Não localizada para a Wave | `NOT_PROVEN` | integrar a superfície completa, executar gates do pacote, provar tenancy/RLS, receipts e equivalência em runtime |
| 2 — Agent Birth + Prompt Compiler | 3 | `wave2/agent-birth-2026-09-12` @ `1ac8bfe1` | AgentDefinition/compiler: condicional; Registry V2: não provado | `PASS-CONDICIONAL` | validar origem/approval/tenant no caller, fechar prompt semântico e rever Registry V2 |
| 3 — Session-Aware Runtime | 4 | `wave3/session-runtime-skeleton-2026-09-12` @ `42fd6cba` | Re-review V8: fixes de redaction/epoch PASS; enforcement obrigatório/CAS ainda NOT_PROVEN | `PASS-CONDICIONAL` | redaction fail-closed, CAS/transação distribuída, actor/policy sistémicos e re-review de integração |
| 4 — BrowserMesh + Shift | 2 | `wave4/browsermesh-wake-2026-09-12` @ `03b06159` | Re-review V8: HMAC/schema PASS condicional; actor registry e replay NOT_PROVEN | `PASS-CONDICIONAL` | segredo gerido, actor/capability independente, deduplicação de replay e BrowserMesh real |
| 5 — Command Center | 1 | `wave5/command-center-2026-09-12` @ `431183d2` | Approvals/Overview novos; revisão Baluarte específica não localizada | `NOT_PROVEN` | implementar as restantes superfícies e persistência de estado/custo/evidence/approval; integração tenant-scoped |
| 6 — Studio Commercial MVP | 1 | `wave6/studio-comercial-2026-09-12` @ `30434ed5` | token/ProjectSpec condicional | `PASS-CONDICIONAL` | re-rever fix de expiry/single-use, persistência, portal e fluxo cliente real |
| 7 — Studio Editor | 1 | `wave7-8/studio-editor-2026-09-12` @ `ada5651f` | AI Edits/ContextPack novos; revisão Baluarte específica não localizada | `NOT_PROVEN` | Canvas/edit/variant/evals/approval completos e isolamento persistente |
| 8 — Asset Intelligence | 2 | `wave8/asset-intelligence-2026-09-13` @ `76dbeb4b` | Reverse Design: PASS limitado | `PASS-CONDICIONAL` | enforcement de licença/proveniência, storage, análise real e revisão do LayerManifest |
| 9 — Product Factory Web | 1 | `wave9/product-factory-2026-09-12` @ `fd6e3f3d` | ciclos: PASS; repair terminal: bloqueado no SHA revisto; fix final não re-revisto | `BLOCKED` | prova durável de tentativas/bloqueio/idempotência e fronteira de build/release |
| 10 — Mobile + Delivery | 1 | `wave10/mobile-delivery-2026-09-13` @ `affbc751` | gate de entrega bloqueado | `BLOCKED` | acoplar validação à ação de entrega, status APPROVED/PACKAGED, canal/plataforma e evidence verificável |
| 11 — Unified Integrations | 2 | `wave11/consent-registry-2026-09-12` @ `482b092d` | consent gate local PASS; enforcement sistémico não provado | `PASS-CONDICIONAL` | adapters/providers, webhook/replay, RLS, Secret Proxy, consentimento persistente e delivery real |
| 12 — Marketing + Video | 2 | `wave12/marketing-content-2026-09-13` @ `532ff4ba` | Re-review V7: freshness futura PASS; integração/ledger e restante Wave não provados | `PASS-CONDICIONAL` | claims/provenance, consent/likeness, publicação, métricas reais e integração durável |
| 13 — Hermes + Memória Avançada | 1 | `wave13/hermes-source-registry-2026-09-12` @ `077d931c` | Re-review V10: Freshness Engine PASS; registry durável/integrado NOT_PROVEN | `PASS-CONDICIONAL` | Memory Gateway, namespaces, Graphiti OFF/SHADOW, retenção e reconstrução persistente |
| 14 — Evals + Agent Evolution | 1 | `wave14-15/evals-autonomy-2026-09-12` @ `5cd7531c` | Re-review V10: permission gate PASS local; identidade/estado distribuído NOT_PROVEN | `PASS-CONDICIONAL` | evals independentes, requester autenticado, persistência concorrente e gate de promoção |
| 15 — Autonomy + Optimization | 2 | `wave15/resource-router-2026-09-13` @ `67781285` | watchdog local PASS; persistência/idempotência não provadas | `NOT_PROVEN` | Goal/health/budget/promoção e reroute duráveis, sem ampliar autoridade |
| 16 — PsycheOS | 3 | `psycheos/affect-ledger-2026-09-12` @ `02f2eda5` | Re-review V9: gate sistémico e boundary PASS; integração de todos os callers NOT_PROVEN | `PASS-CONDICIONAL` | eval independente contínuo, integração dos callers, caps/policy e rollout OFF/SHADOW |

**Resumo de estados atualizado:** `PASS`: 0; `PASS-CONDICIONAL`: 10; `BLOCKED`: 2; `NOT_PROVEN`: 4. Base: re-reviews Baluarte V7–V10 e SHAs atuais das worktrees; estes números são estados de conformidade, não contagem de código.

## 3. Raio-x por Wave

### Wave 1 — Operating Core

**FACT — 13 peças de produção:** `contracts/evidence.ts`, `contracts/wave1-operating-core.ts`, `policies/approval.ts`, `cli/lumenva.ts`, `scripts/lumenva.ts`, cinco módulos MCP (`catalogo/funil.ts`, `catalogo/index.ts`, `catalogo/operating-core.ts`, `tools/index.ts`, `tools/operating-core.ts`) e três módulos `packages/operating-core/src` (`contracts.ts`, `event-log-adapter.ts`, `job-engine.ts`). Há 9 ficheiros de teste no branch observado.

**Segurança:** `NOT_PROVEN`. Não há relatório Baluarte específico da Wave 1 em `scratch-council/security/`. A auditoria de providers prova alguns mocks e boundaries de WAHA/Supabase, mas não é uma revisão do Operating Core inteiro.

**Falta para produção:** branch integrado e gates declarados executados no pacote; prova de tenant/RLS e actor/capability; persistência transacional de job/event/approval; receipts/evidence duráveis; equivalência API/MCP/CLI em runtime; revisão de segurança por SHA final. O código real não transforma a Wave em “code-complete em produção”.

### Wave 2 — Agent Birth + Prompt Compiler

**FACT — 3 peças:** `agent-definition.ts`, `prompt-compiler.ts` e `agent-definition-registry.ts`, com 3 testes.

**Segurança:** `PASS-CONDICIONAL`. `REVIEW-AGENT-BIRTH-V1.md` confirma fail-closed local para campos mínimos e rejeição de `SHADOW`; a correção de delimitadores/escaping fecha a injeção estrutural testada. Permanecem `NOT_PROVEN` a origem/autoria/approval/tenant da definição, a validação novamente no compiler e a resistência à instrução maliciosa semântica. O Registry V2 da worktree atual não tem revisão Baluarte específica.

**Falta para produção:** validar definição no boundary de persistência e no caller; ligar policy/actor/organization/approval; impor limites e normalização de conteúdo; registry durável/concorrente com versão e unicidade; re-review dos três módulos no SHA `1ac8bfe1`.

### Wave 3 — Session-Aware Runtime

**FACT — 4 peças:** `session-service.ts`, `memory-gate.ts`, `dispatch-router.ts` e `handoff-pack.ts`. `ToolLoopLock` está no mesmo módulo de session service nesta worktree; há 5 testes.

**Segurança:** `BLOCKED`. `REVIEW-SESSION-SERVICE-V1.md` classifica o skeleton apenas como PASS de tipos; locks e supersession são somente single-process; o HandoffPack foi inicialmente FAIL por redaction e epoch e, mesmo após `42fd6cba`, permanece condicional/bloqueado para prova de redaction robusta, reconstrução completa e CAS/transação real. A revisão também exige actor e disponibilidade fail-closed no dispatch.

**Falta para produção:** redaction obrigatória no boundary de handoff; teste com base distinta e epoch aplicado; store real com CAS/unique constraint; enforcement de tenant/actor/capability/policy; quotas, adapters, pulse e continuidade integrados; executar e rever o SHA final.

### Wave 4 — BrowserMesh + Shift

**FACT — 2 peças:** `event-wake.ts` e `action-bus.ts`, com 2 testes. A branch contém fixes de envelope, approval e contexto de ação.

**Segurança:** `BLOCKED`. `REVIEW-WAVE4-V1.md` encontrou wake forjável: faltavam actor, assinatura/source e idempotency key. Os fixes posteriores (`46dbe1c0`) não têm relatório Baluarte novo neste conjunto; não podem ser considerados aprovados por inferência.

**Falta para produção:** autenticação da origem, actor/capability derivada de boundary confiável, assinatura e replay protection; validação de schema antes de queue; leases/concorrência; persistência no BrowserMesh real; receipts e prova Event → Workforce → wake → work → persist → sleep; re-review do SHA final.

### Wave 5 — Command Center

**FACT — 1 peça:** `command-center/overview-state.ts`, com 1 teste. A peça lista agentes ativos, soma custo mockado e lista jobs pendentes; rejeita tenant divergente, moeda mista e valor inválido.

**Segurança:** `NOT_PROVEN`. Não há relatório Baluarte específico. O teste é provider-free e em memória; não prova a superfície completa do Command Center nem persistência.

**Falta para produção:** Chat, Agents, Workforce, Jobs, Workflows, Activity, Sessions, Infrastructure, Dev, Approvals, Incidents, Costs, Projects e Deployments; source/evidence/goals/approvals persistidos; autoridade tenant-scoped; custo com semântica histórica definida; RLS, audit trail, API/UI e integração com event log/Action Bus.

### Wave 6 — Studio Commercial MVP

**FACT — 1 peça:** `studio/project-spec.ts`, com teste. A branch atual inclui o fix de expiry e single-use (`30434ed5`), mas a revisão inicial foi feita antes desse fix.

**Segurança:** `PASS-CONDICIONAL`. `REVIEW-WAVE6-9-V1.md` confirma token criptograficamente forte, opaco, hash persistido e scope/tenant checks. A revisão apontou `Date.parse` inválido e `single_use` não consumido; o branch atual contém uma correção, ainda sem re-review Baluarte. Client portal, comments, approvals e evidence continuam fora da prova.

**Falta para produção:** re-review do SHA atual; persistência/consumo atômico do token; expiração com datas inválidas fail-closed; portal com token opaco, comentários, approval/request edits; RLS, rate limit, audit/evidence e fluxo de cliente real.

### Wave 7 — Studio Editor

**FACT — 1 peça:** `studio/context-pack.ts`, no branch combinado `wave7-8/studio-editor-2026-09-12`, com 1 teste. Isto é um ContextPack, não o Canvas/editor completo descrito no contrato.

**Segurança:** `NOT_PROVEN`. Não há revisão Baluarte específica da Wave 7.

**Falta para produção:** Canvas versionado, AI edits, variant mixing, layer locks, diff/preview/evals, approvals, idempotência, provenance e persistência. O ContextPack isolado não prova que prompts/assets não conseguem alterar autoridade ou publicar.

### Wave 8 — Asset Intelligence

**FACT — 2 peças:** `asset-intelligence/layer-manifest.ts` e `reverse-design.ts`, com 2 testes.

**Segurança:** `PASS-CONDICIONAL`. `REVIEW-CONSOLIDADO-V5.md` dá PASS limitado ao Reverse Design como sugestão e não concessão de autorização. Licença, tenant, provenance e enforcement pelo consumidor permanecem `NOT_PROVEN`; o LayerManifest não recebeu revisão independente identificada.

**Falta para produção:** storage/hash/provenance verificáveis; licença/consentimento e retenção; análise de media real; Magic Layers e semantic specs completos; impedir publicação/entrega quando provenance é desconhecida/revogada; re-review do conjunto atual.

### Wave 9 — Product Factory Web

**FACT — 1 peça:** `product-factory/build-plan.ts`, com 1 teste. A branch contém plano acíclico, repair loop e fix de bloqueio terminal.

**Segurança:** `BLOCKED`. `REVIEW-WAVE6-9-V1.md` confirma ciclos/IDs desconhecidos fail-closed, mas classifica o repair loop como bounded apenas por chamada e o bloqueio como não durável: reentrada/concor­rência podiam reiniciar tentativas. O commit `fd6e3f3d` corrigiu parte desse comportamento, mas não foi re-revisto no relatório disponível.

**Falta para produção:** re-review do fix; contador/blocked state atômico por `build_plan_id`/idempotency key; concorrência e reentrada testadas; geradores/preview/testes/release e dispatch isolado; evidência de artifact digest e execução real.

### Wave 10 — Mobile + Delivery

**FACT — 1 peça:** `product-factory/delivery.ts`, com 1 teste. A branch inclui o fix para canais desconhecidos (`affbc751`), mas a revisão aponta o commit anterior `f6585090`.

**Segurança:** `BLOCKED`. `REVIEW-WAVE10-V1.md` encontrou predicado sem fronteira de execução: não exige `APPROVED`/`PACKAGED`, não liga canal à plataforma e não impede o caller de ignorar o retorno. Refs de evidence são strings não vazias, não provas resolvidas.

**Falta para produção:** função de delivery que pare em qualquer falha; status/canal/plataforma/capability/approval/environment; hashes e provenance verificáveis; stores e receipts; testes por canal, especialmente `MANAGED_SERVICE`; re-review de `affbc751`.

### Wave 11 — Unified Integrations

**FACT — 2 peças:** `integrations/consent-registry.ts` e `consent-memory-gate.ts`, com 2 testes. Não são ainda os adapters WhatsApp/Instagram/Facebook/email/voice/Google completos.

**Segurança:** `PASS-CONDICIONAL`. `REVIEW-CONSOLIDADO-V6.md` dá PASS local ao fail-closed do Consent Memory Gate, mas marca enforcement sistémico, durabilidade e evidence documental como `NOT_PROVEN`; também observa integração Wave 3+11 no SHA revisto.

**Falta para produção:** Secret Proxy e adapters allowlisted; webhook signature/replay; Contact/Conversation/Relationship Memory persistentes; consent purpose/channel-scoped e revogável; rate limits, egress, delivery reconciliation, provider accounts e RLS; nenhuma credencial/probe live foi provada.

### Wave 12 — Marketing + Video

**FACT — 2 peças:** `knowledge/content-provenance.ts` e `freshness-engine.ts`, com 2 testes. A branch inclui `532ff4ba`, fix que rejeita timestamps futuros.

**Segurança:** `BLOCKED` até re-review. `REVIEW-CONSOLIDADO-V5.md` classificou Freshness Engine como FAIL porque timestamp futuro era tratado como `current`; o fix posterior não tem revisão Baluarte disponível. O relatório também não cobre CMO, publication, likeness, video, analytics ou providers.

**Falta para produção:** re-review do fix; claims com source/evidence/freshness/confidence; human review para claims/crise/publicação; consentimento de likeness/voice/music; adapters e accounts; métricas com denominador/atribuição; publicação e Teacher/Video reais.

### Wave 13 — Hermes + Memória Avançada

**FACT — 1 peça:** `memory/source-registry.ts`, com 1 teste. É um Source Registry; não é ainda Memory Gateway, Graphiti reconstruível, Canon ou Freshness Engine completo.

**Segurança:** `NOT_PROVEN`. Não há revisão Baluarte específica da Wave 13.

**Falta para produção:** namespaces e ownership; Memory Gateway com write/read gates; source authority/licensing/freshness; Graphiti OFF/SHADOW; retenção/redaction/supersession; reconstrução a partir do ledger; RLS e prova de não cruzamento owner/home/company/tenant.

### Wave 14 — Evals + Agent Evolution

**FACT — 1 peça:** `psycheos/no-progress-watchdog.ts` no branch combinado `wave14-15/evals-autonomy-2026-09-12`, com 1 teste. Apesar do nome da branch, a peça observada é um sinal de watchdog, não uma suíte completa de evals/evolução.

**Segurança:** `NOT_PROVEN`. `REVIEW-CONSOLIDADO-V3/V4` considera os evals úteis como smoke local, mas não prova sistémica; faltam persistência, concorrência, truth/evidence e integração com policy/approval. Qualquer `FAIL` deve bloquear, mas o runner não é prova de gate global.

**Falta para produção:** evals independentes de recall/supersession/freshness/isolation/permission/red-team; fixtures adversariais não tautológicas; ligação obrigatória ao promotion gate; persistência de resultados/evidence; regressão por SHA e veto por FAIL.

### Wave 15 — Autonomy + Optimization

**FACT — 2 peças:** `memory/no-progress-watchdog.ts` e `memory/resource-router.ts`, com 2 testes.

**Segurança:** `NOT_PROVEN`. `REVIEW-CONSOLIDADO-V5.md` dá PASS local ao limiar e fallback do watchdog, mas `NOT_PROVEN` à persistência, autenticidade da observação e idempotência do reroute.

**Falta para produção:** Goal Lite/continuity loop/health states/budgets; reroute persistente e deduplicado; Resource Router com actor/assignment/availability fail-closed; promoção A0–A5 vinculada a eval/reliability/incidents; prova de que autonomia não amplia capability nem budget.

### Wave 16 — PsycheOS

**FACT — 3 peças:** `psycheos/affect-ledger.ts`, `boundary-eval.ts` e `psycheos-regression.ts`, com 3 testes.

**Segurança:** `BLOCKED`. `REVIEW-CONSOLIDADO-V2` encontrou rates customizados sem teto e `kind` desconhecido tratado como repair; houve correção local posterior. `REVIEW-CONSOLIDADO-V6` classifica o boundary eval como FAIL enquanto prova forte de independência emocional: o teste é estreito/tautológico. O estado atual não prova separação robusta de affect, factualidade, policy, pricing, capability ou authority.

**Falta para produção:** eval independente com variação e oracle externo; caps e enum validation re-revistos; policy barrier obrigatória; append-only/persistência/decay/trust com RLS; flags OFF/SHADOW; nenhum rollout human-facing antes de Wave 14 e aprovação do dono.

## 4. Dependências de produção ainda abertas

Estas lacunas atravessam várias Waves e impedem transformar a contagem de módulos em prontidão:

1. **Integração:** os branches de Wave não equivalem a merge em `main`; cada SHA precisa de cherry-pick/merge autorizado, testes no checkout final e diff/status limpos.
2. **Tenancy e autoridade:** a maioria das peças valida objetos em memória. Falta provar `organization_id` derivado de boundary confiável, actor/capability, RLS e ausência de bypass entre API, MCP, CLI, job e adapter.
3. **Persistência e concorrência:** locks, supersession, token single-use, retry budgets, repair blocks, watchdogs e receipts locais não provam CAS/transação/unique constraint entre workers.
4. **Evidence:** strings não vazias, previews, receipts ou testes unitários não provam hash, provenance, source, exit code, provider event ou efeito observado.
5. **Providers e execução:** não há prova live de WAHA, Resend, Supabase/RLS, Meta/Google, email, voice, storage, BrowserMesh, deploy, app stores ou cliente pagante. Os gaps de provider permanecem `NOT_PROVEN` conforme `AUDITORIA-PROVIDERS-V1.md`.
6. **Release:** falta uma sequência por SHA: gates unit/typecheck/lint, security review do SHA final, integração, Crivo/Baluarte, smoke autorizado, rollback e evidência de produção. Nenhum relatório desta pasta autoriza deploy.

## 5. Conclusão

**Veredito:** há pelo menos uma peça de código real em cada Wave, mas “16 Waves com código” é apenas um marco de implementação local. A fotografia honesta antes de continuar é:

- nenhuma Wave está provada como produção;
- 6 Waves estão bloqueadas por achados de segurança ou enforcement insuficiente;
- 4 têm PASS local/condicional limitado, sempre com follow-up explícito;
- 6 permanecem sem prova Baluarte suficiente;
- os fixes posteriores aos relatórios precisam de re-review, não de crédito automático.

O próximo gate correto é escolher uma Wave, fixar o SHA final e fechar o ciclo `testes → segurança → integração → persistência/RLS → smoke autorizado → evidence`. Não tratar este documento como autorização de merge, deploy ou provider live.

## Self-check

PASS — plano, contratos, branches/worktrees e relatórios de segurança foram cruzados; contagem exclui testes/documentação; ausência de revisão foi mantida como `NOT_PROVEN`; nenhum claim de produção foi inferido a partir de código local.
