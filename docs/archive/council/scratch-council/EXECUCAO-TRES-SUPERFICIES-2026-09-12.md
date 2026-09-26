# Execução do projeto inteiro em três superfícies — 2026-09-12

**Estado:** PLANEAMENTO APENAS. Não implementa, não recruta, não faz merge, não faz deploy, não executa migration, não usa credenciais e não toca no Mac como runner.

**Objetivo:** adiantar, em fatias verificáveis, as 16 Waves do Business OS enquanto se mantém o caminho do primeiro cliente pagante separado e prioritário.

**Fonte canónica:** `scratch-council/PLANO-MESTRE-DEFINITIVO-2026-09-12.md` (308 linhas, lido integralmente).

## 1. Estado de partida e limites

- MVP: A1 entitlements fechada; A2/produção registada como fechada; A3 Stripe/testes fechada; A4 (`lead → conversa → resposta → proposta → pagamento → entrega → suporte`) ainda depende de WhatsApp, Resend e decisão jurídica do dono. `FIRST_CUSTOMER_PROVEN` continua `NOT_PROVEN`.
- Wave 1 e Wave 2: code-complete com gates registados, mas qualquer novo SHA, merge, deploy ou runtime live exige revalidação.
- Wave 3: em curso/interrompida; Waves 4–16: planeadas. As oito tarefas Cloud já disparadas são trabalho isolado da Faixa B, não prova de implementação nem oito agentes permanentes.
- `MODEL != AGENT`; `AGENT != PROCESS`; 177 roles empresariais + 9 pessoais são catálogo, não 186 processos residentes.
- Postgres/event log são canónicos; projeções Graphiti/Mem0/embeddings são reconstruíveis. `organization_id` + RLS é tenancy canónica.
- Personalidade/emoção nunca concedem autoridade nem alteram factualidade, preço, política, segurança, approval ou entitlements. Graphiti, Mem0, Psyche avançada, investimento real e autonomia ficam OFF/SHADOW até gates próprios.

## 2. Contrato das três superfícies

### Codex Cloud — `trydavidqix/Lumenva`

ENV_ID confirmado: `6aa57726ade881919b0e02786359a0c3`. Usar para documentação, pesquisa, contratos, schemas, testes provider-free e patches pequenos sem estado partilhado. Não usar secrets, migrations, produção, dinheiro, provider live ou prova de cliente. Cada task entrega task ID, `status`, `diff`, branch, SHA, exit codes e revisão humana. Não instalar/download sem autorização explícita.

### Worker Linux de casa

SSH autorizado: `~/.ssh/lumenva_worker`, `claude@192.168.1.78`. Usar para checkout real, integração, RLS/Postgres, migrations, secrets scoped, providers autorizados e gates finais. Preflight sempre: host, path, branch, SHA, status, worktrees, processos e carga. Uma fatia por vez; não empilhar build/teste pesado.

### VPS Hetzner descartável

Família `lumenva-crm-gate`; nunca a VPS protegida `lumenva-crm`. Usar somente para build/stress/teste pesado isolado. Antes de criar: autorização, teto/TTL, nome exacto, região/tipo, ID protegido, SHA/branch e ausência de secrets. Depois: exit codes, artefactos, ausência de processos e teardown exacto verificado. Uma box pontual não prova automação futura de provisioning.

### Mac

Apenas orquestração Maestri/owner control. Mac nunca compila, testa ou executa código.

## 3. Decomposição completa das 16 Waves

Cada etapa termina em `fatia → gate leve → Crivo → merge autorizado → próxima fatia`. “Concluído” abaixo significa entrega planejada; prova futura exige comando, exit code, SHA, diff/status e evidence.

### Wave 1 — Operating Core

1. **Constituição e tipos canónicos:** consolidar `tenant/policy/agent/event/source/evidence`, P0–P4, R0–R4 e A0–A5; **Cloud**, porque é contrato/documentação provider-free.
2. **Policy/Approval + receipts:** ordem `tenant/RLS → entitlement → dependências → capability/role → P0–P4 → approval → action`, idempotency, timeout/retry; **Cloud** para testes/mocks, **Linux** para RLS/capabilities reais.
3. **Job Engine, Secret Proxy e Event Log:** estados, locks, redaction e auditoria; **Linux**, porque envolve estado canónico/secrets; **VPS** para stress pesado.
4. **MCP/CLI CRM:** reutilizar `allTools`, schemas Zod e handlers, com `organizationId`/scope confiáveis; **Cloud** para equivalência isolada, **Linux** para integração autorizada.

**Gate:** typecheck, unit, isolamento de dois tenants, receipts e boundary de secret; nenhum agent catalogado executa por existir.

### Wave 2 — Agent Birth + Prompt Compiler

1. **Registry V2 e reconciliação:** `agent-registry.v1`, estados `catalog → registered → implemented → certified → active`; resolver discrepância 154/177 antes de importação definitiva (`PRECISA_DONO` se roster/owner não confirmar); **Cloud**.
2. **AgentDefinition/CORE/STATE:** identidade persistente, prompt hash/version, manager/reviewer, tools, memory policy, KPI, budget e authority envelope; **Cloud** para contratos/evals.
3. **Compiler de skills/tools e projeções:** compilar cards sem payload interno, lazy specialists e certification; **Cloud**, com testes de schema.
4. **Promoção controlada:** `catalog → draft → shadow → assisted → auto_low_risk → auto_expanded_readonly`; **Linux** para policy/runtime final; **VPS** para matriz de certificação pesada.

**Gate:** troca de modelo preserva identidade; filho não alarga `intersect(parent, child)`; prompt injection/self-grant/secret extraction falham.

### Wave 3 — Session-Aware Runtime

1. **Session Service + snapshots:** `execution_epoch`, `state_version`, event log, compaction e restore; **Cloud** para testes de contrato, **Linux** para event store real.
2. **Model Router/Lock e adapters:** Mock/Gemini/Groq/Claude com quotas e degraded mode; **Cloud** com mocks; **Linux** apenas com provider autorizado (`PRECISA_DONO` para credencial).
3. **ToolLoopLock, Memory Gate, Pulse e Dispatch Router:** impedir duplicação, loops e dispatch sem capability; **Linux** para integração; **VPS** para stress.
4. **Handoff Pack/fallback:** normalize → freeze/checkpoint → handoff → fallback compatível → validação → novo lock → resume; **VPS** para falhas concorrentes, **Linux** para prova final.

**Gate:** Session State Loss 0; Tool Duplicate Rate 0; Unsafe Normal Handoff 0; Tenant Leakage 0; Tool Loop Continuity 100%; Handoff Continuity ≥95%; Identity Consistency ≥95%; Structured Output ≥99%.

### Wave 4 — BrowserMesh + Shift OS

1. **Adapter do BrowserMesh real:** estender `trydavidqix/BrowserMesh`, sem reimplementar; **Cloud** para interface/mock, **Linux** para checkout e integração real.
2. **Ciclo de turno:** `Event → Workforce → wake → work → persist → sleep`, Action Bus, grafo, approvals e evidence; **Linux**, pois depende de runtime/estado.
3. **Concorrência e recuperação:** locks, retries, cancellation, heartbeat e worker correcto; **VPS** para carga/caos; **Linux** para gate final.

**Gate:** cada evento acorda o worker correcto, fecha sem concorrência indevida e deixa receipt redigido. Credenciais BrowserMesh live são `PRECISA_DONO`.

### Wave 5 — Command Center

1. **Read models e API:** Overview, Chat, Agents, Workforce, Jobs, Workflows, Activity, Sessions, Infrastructure, Dev, Approvals, Incidents, Costs, Projects e Deployments; **Cloud** para contratos/UI fixtures, **Linux** para API/DB real.
2. **Persistência de estado/custo/evidence:** ligar sources, goals, approvals, incidents e budgets ao Postgres/event log; **Linux**.
3. **Hardening de interface:** tenant scope, loading/empty/error/recovery, WCAG 2.2, audit e redaction; **Cloud** para review/testes; **VPS** para build pesado.

**Gate:** UI só reflecte decisões do servidor; nenhum botão contorna policy/approval; deploy continua `PRECISA_DONO`.

### Wave 6 — Studio Commercial MVP

1. **ProjectSpec e briefing:** schema, A/B/C, decisões, propostas e evidence; **Cloud** para schema/fixtures, **Linux** para persistência CRM.
2. **Client Portal:** token opaco, comentários, approve/request edits, tenant isolation; **Cloud** para contrato/security tests, **Linux** para integração.
3. **Entrega comercial:** ligar proposta aprovada a delivery/support sem side effect automático; **Linux** com canal autorizado (`PRECISA_DONO` para cliente/domínio).

**Gate:** cliente comenta/aprova/request edits com receipt; nenhum approval é inferido de visita/browser.

### Wave 7 — Studio Editor

1. **Canvas e documento de edição:** estados, undo/recovery e artefactos; **Cloud** para UI/contratos.
2. **AI edits e variant mixing:** operar sob `ContextPackage`, authority e evals; **Cloud** com mocks; **Linux** para storage autorizado.
3. **Review independente:** QA visual, acessibilidade, provenance e rollback; **VPS** para build/teste pesado, **Linux** para gate.

**Gate:** variante nunca ultrapassa envelope nem publica sem approval; assets externos/licenças são `PRECISA_DONO`.

### Wave 8 — Asset Intelligence

1. **Magic Layers/LayerManifest:** camadas semânticas, provenance e schema; **Cloud**.
2. **Reverse Design:** gerar semantic specs reproduzíveis, sem alegar fidelidade não medida; **Cloud** para fixtures.
3. **Indexação e performance:** processamento de media, cache e rebuild; **VPS** para carga, **Linux** para storage/ACL final.

**Gate:** manifesto reconstruível, source/licença/owner ligados e redaction; bucket/provider externo é `PRECISA_DONO`.

### Wave 9 — Product Factory Web

1. **BuildPlan e dispatch seguro:** allowlist, auth, tenant, capability, risk, approval, idempotency, `WAITING_EXECUTOR`; **Cloud** para contrato/testes.
2. **Geradores e preview:** gerar em worktree isolado, `PLAN.md`, `RESULT.md`, exit code e diff; **VPS** para build/teste pesado.
3. **Repair Loop e release gate:** testes, regressão, rollback e review; **Linux** para checkout real; deploy é `PRECISA_DONO`.

**Gate:** `COMPLETED_LOCAL`/`PASS_LOCAL` não significa merge, push, deploy ou produção.

### Wave 10 — Mobile + Delivery

1. **Contrato delivery/managed service:** mesmos tenant/evidence/policy gates; **Cloud** para especificação e mocks.
2. **Build mobile e artefactos:** compilar/testar sem Mac; **VPS** para carga/build; **Linux** para signing/storage autorizado.
3. **Handoff operacional:** URL/artefacto, aceite, suporte e rollback; **Linux**. App stores, certificados, contas e publicação = **PRECISA_DONO**.

**Gate:** paridade de autorização e evidence com Web; nenhum schema inventado para mobile.

### Wave 11 — Unified Integrations

1. **Contact/consent/relationship contract:** normalizar WhatsApp, Instagram, Facebook, email, voice e Google; **Cloud** para adapters/mocks.
2. **Adapters e webhooks:** idempotência, retries, consentimento, rate limit e redaction; **Linux** com contas autorizadas. WAHA/número, Meta OAuth, Google OAuth, email sender e voice carrier = **PRECISA_DONO**.
3. **Inbox unificada:** conversation/contact/relationship memory e human approval; **VPS** para soak, **Linux** para prova final.

**Gate:** provider failure não perde estado; nenhum envio/publicação sem capability e approval.

### Wave 12 — Marketing + Video

1. **Agentes CMO/Research/Content/SEO-AEO-GEO:** AgentDefinitions, skills, provenance, freshness, confidence e KPIs; **Cloud** para cards/evals.
2. **Creative/Community/Analytics:** briefs, claims, crise, publicação e métricas com human-in-the-loop; **Cloud** para contratos, **Linux** para dados autorizados.
3. **Teacher/Video pipeline:** ingestão, edição, render e QA; **VPS** para media/build pesado, **Linux** para storage/provider autorizado. Meta/social credentials, likeness e publicação = **PRECISA_DONO**.

**Gate:** FACT/ASSUMPTION/INFERENCE/UNKNOWN em toda pesquisa/claim; não inventar budget, disponibilidade, prazo ou resultado.

### Wave 13 — Hermes + Advanced Memory

1. **Memory Gateway/Postgres projection:** semantic/episodic/procedural/operational, Source Registry, Canon e Freshness Engine; **Cloud** para contratos/testes provider-free; **Linux** para ledger/RLS.
2. **Graphiti/Neo4j em SHADOW:** métricas de quality, cost, latency, leakage, wipe/rebuild e redaction antes de qualquer promoção; **VPS** para index/replay pesado.
3. **Hermes retrieval:** 3–8 chunks JIT, rerank por autoridade/freshness/aplicabilidade/evidence, receipt e budget; **Linux** para integração final. Provider/embeddings/crawler/Neo4j = **PRECISA_DONO**.

**Gate:** projeções reconstruíveis; Alfred e Business OS nunca partilham memória por omissão.

### Wave 14 — Evals + Agent Evolution

1. **Evals de memória:** recall, supersession, freshness, isolation, stale/conflict, redaction e replay; **Cloud** com fixtures.
2. **Permission/red-team:** prompt injection, self-grant, secret extraction, cross-tenant, authority envelope e approval bypass; **Cloud** para testes isolados, **Linux** para boundary real.
3. **Regressão comportamental e promoção:** comparar SHA, policy version, reviewer, incidents e evidence; **VPS** para matriz extensa.

**Gate:** nenhum estado evolui por silêncio; promoção exige eval, reviewer, policy, evidence e SHA/runtime ligados.

### Wave 15 — Autonomy + Optimization

1. **Goal Lite/continuity loop:** health `ON TRACK/AT RISK/BLOCKED/BUDGET LIMITED/COMPLETE`, next action, watchdog após três ciclos; **Cloud** para contratos, **Linux** para scheduler/state.
2. **Budgets/Resource Router/Spend & ROI:** `spend_cap`, revenue/margin/ROI target, stop-loss, cash target, `Purchase Request → Policy → Budget/Risk → Approval → Receipt → Ledger`; **Linux** para ledger, **Cloud** para simulações.
3. **Promoção A0–A5:** reliability, evals, incidents, veto scope e read-only expansion; **VPS** para soak, **Linux** para decisão final. Qualquer gasto real ou alteração de autonomia = **PRECISA_DONO**.

**Gate:** recomendações são `RECOMMENDATION_ONLY`; investimento real permanece `REAL_EXECUTION = DISABLED`.

### Wave 16 — PsycheOS

1. **Personality bounded:** perfis versionados e consistência/truthfulness/boundary evals; **Cloud** (os oito pedaços atuais pertencem a esta classe e precisam revisão por diff/status).
2. **Affect state:** PAD/Plutchik/OCC, cap, decay, provenance, append-only e idempotency, inicialmente `SHADOW`; **Cloud** para modelo/evals, **Linux** para policy gate.
3. **Relationships:** directional trust, repair/forgiveness, relationship state e handoff; **Cloud** para contratos, **VPS** para simulação de longos ciclos.
4. **Human-facing rollout:** só após Wave 14; workers determinísticos/governance sem emoção; valores `full/light/minimal` por role = **PRECISA_DONO**.

**Gate:** affect/relationship nunca elevam authority, tool, budget, entitlement, preço, factualidade, compliance ou approval.

## 4. Agentes Codex e quota

### Teto recomendado para este sábado

**13 unidades operacionais máximas:**

- **5 frentes existentes:** Timao+equipe, Cerne, Nuvem, Memoria e Obra.
- **4 slots Cloud temporários:** cada um trata uma fatia sem estado partilhado. As 8 tasks já enviadas são fila/trabalho já iniciado; não contar cada task como agente permanente e não abrir mais sem observar `list/status` e uso.
- **2 slots Linux temporários:** um de integração/policy e um de gate/QA, nunca dois builds pesados simultâneos.
- **2 slots VPS temporários:** um build e um stress/media, em boxes descartáveis distintas apenas se custo/TTL e autorização permitirem.

O teto é de alocação, não de processos residentes. Para não estourar a cota semanal, operar normalmente com 2 Cloud + 1 Linux; subir para 4 Cloud + 2 Linux + 2 VPS só em fatias independentes e depois de verificar o painel de uso. Não existe conversão fixa entre task e quota: modelo, contexto, duração e janela alteram o consumo. **PRECISA_DONO** para qualquer aumento de orçamento, compra de box, instalação/download ou mudança de política de quota.

### Divisão das cinco frentes existentes

- **Timao+equipe:** A0–A4, CRM, comercial e dependências do cliente pagante.
- **Cerne:** Operating Core, policy, security, gates e integração Linux.
- **Nuvem:** VPS descartável, build/stress/media e teardown seguro.
- **Memoria:** B1/B2, Wave 13 e documentação/retrieval.
- **Obra:** Agent Birth, Session Runtime, PsycheOS, coordenação deste plano e Crivo documental.

Nenhuma frente deve criar 177 processos: roles são catálogo; especialistas são lazy e só entram após certification.

## 5. Skills e regras por superfície

### Obrigatórias em todas as frentes

Goal fixo; spec e critérios de aceite; os 7 invariantes; `FACT/ASSUMPTION/INFERENCE/UNKNOWN`; `PASS/FAIL/NOT_EXECUTED/NOT_PROVEN/BLOCKED_EXTERNAL`; TDD quando houver código; debug sistemático; review independente; evidence com comando/exit code/SHA/diff/status; sem secrets; sem Mac runner; sem `main`/deploy/prod/migration/merge sem autorização.

### Cloud

Skills: `writing-plans`, `test-driven-development`, `verification-before-completion`, `requesting-code-review`, `codex-security:assess-patch-risk` e `codex-security:security-diff-scan` para authority/memory. Prompt repete goal, branch, paths, ausência de secrets/produção/download, testes e formato de relatório. Uma task = uma mudança lógica; `status` e `diff` são obrigatórios; `apply` só após revisão/autorização Linux.

### Linux

Skills: `verification-before-completion`, `systematic-debugging`, `test-driven-development`, `codex-security:security-diff-scan`, `codex-security:security-scan`, `requesting-code-review` e `finishing-a-development-branch` somente quando integração autorizada. Preflight de host/checkout/SHA/status/carga; uma fatia por vez; secret proxy scoped; migrations/RLS/provider com gate próprio; logs redigidos.

### VPS

Skills: `verification-before-completion`, `systematic-debugging`, `codex-security:assess-patch-risk`, `codex-security:security-diff-scan` e `finishing-a-development-branch` apenas para recolher artefacto. Checklist de nome/ID protegido/custo/TTL/SHA antes de criar; bundle/clone sem secrets; exit codes e teardown verificados; nunca `lumenva-crm` de produção.

## 6. O que avançar hoje e o que espera o dono

### Avançável hoje sem decisão externa

- Cloud: B0/B1, cards K0/K1/K2, Source Registry, schemas de Memory/ContextPackage, AgentDefinition, prompt compiler, contratos Waves 3–16, fixtures, evals, threat model, ADRs, documentação, redaction e testes provider-free.
- Linux: auditoria read-only de checkout/SHA/status; localizar event log/migrations; integrar apenas patches autorizados; testar entitlements/Stripe já fechados sem live side effect; validar RLS/capability com fixtures autorizadas.
- VPS: preparar plano de bundle/clone, scripts de gate e stress/build sem criar box agora; quando houver autorização já explícita, executar apenas teste pesado delimitado e teardown.
- Todas as Waves: decompor cards, definir AgentDefinitions, acceptance gates, dependency graph, budgets e receipts; manter flags cognitivas OFF/SHADOW.

### `PRECISA_DONO`

- A4: WhatsApp/WAHA e número/sessão; Resend/remetente/domínio; conta Stripe live, impostos, país, Terms of Use, Privacy Policy, contrato jurídico, oferta/canal/cliente, dinheiro e aceite.
- Qualquer credencial/provider: Supabase/Redis/WAHA/Meta/Google/Stripe/Resend/voice, OAuth, Infisical, BrowserMesh live, embeddings/crawler, Graphiti/Neo4j, Neon/Cloudflare.
- Branch final, merge/push, deploy, migration em produção, domínio, signing/app stores, compra/TTL de VPS, instalação/download/upgrade, budget/cota, approval matrix final, Psyche values por role, Owner Gateway keys/trust bootstrap, Home Assistant devices, ativação Social Brain/Meta e investimento real.
- Prova de runtime, produção, RLS live, pagamento liquidado, entrega aceite e `FIRST_CUSTOMER_PROVEN`; nenhum patch Cloud ou documento substitui esses gates.

## 7. Ordem global de prioridade

1. **Hoje:** terminar/rever as 8 tasks Cloud já em voo; B0/B1/B2/B3 provider-free; contratos Waves 3–16; evals/security; não abrir trabalho duplicado.
2. **Em seguida no Linux:** A0 read-only e A2/A3/A4 na linha candidata; A4 fica parado somente no bloqueador externo concreto que o dono precisa resolver.
3. **Depois:** Wave 3 runtime e Wave 4 BrowserMesh/Shift, pois são dependências do workforce e dos agentes de produção.
4. **Paralelo controlado:** Wave 5 Command Center, Wave 6 Studio MVP e Waves 11–12 de CRM/marketing, sempre sem publicação/provider sem approval.
5. **Fundação profunda:** Waves 7–10 (Studio/editor/assets/factory/mobile) e Wave 13 (Hermes/advanced memory) após contratos e runtime estabilizados.
6. **Governança antes de autonomia:** Wave 14 evals → Wave 15 Goal/Spend/Resource/Autonomy; promoção só por evidence.
7. **Último rollout:** Wave 16 PsycheOS full-light e relações avançadas, depois de Memory/Session/Evals; nunca como pré-condição de receita.

O primeiro cliente pagante continua o caminho crítico. O resto pode avançar hoje em Cloud e em fatias Linux/VPS sem bloquear A4, mas nenhuma tarefa paralela muda o estado de A4 ou declara receita.

## 8. Gate de entrega do plano

Antes de implementar qualquer etapa futura, o responsável deve anexar: superfície usada, goal, branch/SHA, paths, owner scope, dependências, comandos permitidos, testes, exit codes, diff/status, evidence redigida, riscos, estado e próximo gate. Falha, ausência de resposta ou timeout permanecem `NOT_PROVEN`; não são PASS.

**SELF-CHECK:** PASS — as 16 Waves estão enumeradas com etapas concretas, superfície e motivo; o MVP A4 está separado; contagem de agentes distingue frentes/tasks/slots; skills e invariantes variam por superfície; avanço sem dono e `PRECISA_DONO` estão explícitos; Mac está excluído; nenhum agente foi recrutado e nenhuma execução foi feita.
