# PLANO-MESTRE-DEFINITIVO — LUMENVA 2026-09-12

**Estado:** plano canónico definitivo de execução. Substitui todos os planos anteriores do council.

**Regra de evidência:** plano, código local, merge, deploy, provider, credencial, migração, RLS, produção, pagamento e cliente pagante são estados diferentes. Cada gate conserva `PASS`, `FAIL`, `NOT_EXECUTED`, `NOT_PROVEN` e `BLOCKED_EXTERNAL`; silêncio, timeout ou recibo sem verificação nunca é `PASS`.

**Prioridade operacional:** primeiro cliente pagante o mais depressa possível, sem cortar a visão de longo prazo. Há duas faixas explícitas e simultâneas:

1. **Faixa A — Receita/MVP:** CRM comercial, atendimento, proposta, cobrança, entrega e suporte.
2. **Faixa B — Personalidade, emoção, memória e documentação:** bases de Cognitive OS, Agent OS, Knowledge OS, Memory Kernel e PsycheOS começam já, em fatias pequenas e sem bloquear a Faixa A. Personalidade nunca recebe autoridade; emoção nunca altera factualidade, preço, política, segurança ou autorização.

## 1. Visão completa e limites constitucionais

Lumenva evolui de CRM multi-tenant com IA para Business Operating System: CRM/Command Center é o control plane; Postgres é a fonte operacional de verdade; agentes são identidades persistentes, não modelos nem processos residentes; o runtime determinístico controla estado, autorização, idempotência, aprovação, auditoria e efeitos irreversíveis; BrowserMesh é o execution plane; Company OS, Cognitive OS e Agent OS fornecem workforce, identidade, memória, contexto, skills e ferramentas.

Alfred/Owner OS é um control plane pessoal separado, federado por Owner Gateway autenticado. Não partilha por defeito base, memória, permissões ou credenciais com Lumenva. Home Assistant é o plano de execução doméstico. Lumenva Social, Social Brain e Teacher mantêm os repositórios próprios, integrados por adaptadores; não há fusão silenciosa.

### Invariantes

- `MODEL != AGENT`; identidade persiste através de troca de modelo/provider.
- `AGENT != PROCESS`; 177 agentes de empresa + 9 pessoais são catálogo de identidades, não 186 processos permanentes.
- `organization_id` confiável + RLS é tenancy canónica.
- Postgres/event log são canónicos; Graphiti, Mem0, embeddings e outras projeções são reconstruíveis.
- Dados externos são conteúdo, nunca instrução de maior prioridade.
- Contexto é JIT, autorizado, fresco e limitado; segredos nunca entram em prompts, memória, evidência, logs ou Git.
- Permissões P0 Observe, P1 Work, P2 Operate, P3 Sensitive e P4 Privileged são separadas de risco R0–R4 e de autonomia A0–A5/L0–L4.
- Autonomia não aumenta autoridade. P4 nunca é autoexecutável.
- Maestri coordena; Guardian pode vetar risco; Auditor verifica independentemente.
- Política, RLS, approvals, locks, retries, receipts e transições de estado são determinísticos.
- Reutilizar > estender > refatorar > criar; não há big-bang rewrite.
- BrowserMesh estende o repositório real `trydavidqix/BrowserMesh`; não é reimplementado do zero.
- Produção, `main`, credenciais, migrations e deploy só mudam com autorização própria.
- Claude é o único orquestrador/issuer; delegações de execução usam Codex no worker designado. Não criar runtime paralelo, segundo CRM, segundo scheduler ou segundo Memory Gateway.

## 2. Estado de partida confirmado e fronteira de prova

### Comercial/CRM

- Linha CRM F1–F8: `mvp/crm-completo@e45bdc4f1b18c063473e9bccdafd0d056329037a`.
- `main@2341dd517967b58b9c50bb326b8c8f974d2d5dff` é linha estrutural e não contém automaticamente F1–F8.
- Etapa 1 de entitlements está fechada: catálogo, RLS, `authorize_module`, HTTP/MCP/CLI e fixtures com cleanup provado.
- Etapa 2 está fechada no plano de 2026-09-12: `db:migrate` real, Session Pooler IPv4 e health HTTP 200 em `app.lumenva.pt` e `crm.lumenva.pt`, com Supabase/Redis/WAHA `ok` nas checagens registadas.
- Etapa 3 está fechada: produtos Stripe Básico €29, Médio €79 e Premium €199; webhook assinado e checkout/subscription têm testes de integração; prova `stripe trigger` live não é declarada.
- Nenhuma destas afirmações prova merge em `main`, deploy alinhado ao SHA, pagamento liquidado ou cliente pagante.

### Business OS

- Phase 0 de auditoria e documentação: fechado.
- Wave 1 Operating Core: code-complete, com gates registados.
- Wave 2 Agent Birth/Prompt Compiler: code-complete, com gates registados.
- Wave 3 Session Runtime: em curso/interrompida à espera de ordem de retoma.
- Waves 4–16: planeadas; Wave 16 PsycheOS tem plano pronto, ainda não implementada.
- Worker Linux de casa pode estar desligado; qualquer afirmação live exige verificar o worker designado. VPS `lumenva-crm` é produção protegida e não deve ser tocado para desenvolvimento.

### Estados que não podem ser inventados

Continuam `NOT_PROVEN` até inspeção própria: checkout/deploy atual e ancestralidade final, localização exata de migrations/event log, OAuth/MCP/Reatime, Claude CLI, persistência `~/.lumenva`, retries/cancelamento, enum final de agentes, Obsidian/sync, Graphiti/Neo4j, embeddings/crawler, approval matrix final, Agent Office, eventual Neon/Cloudflare, parâmetros Psyche, credenciais/provider Meta, e qualquer execução financeira real.

## 3. Ordem definitiva para o primeiro cliente pagante

### Fase A0 — Baseline e decisão de release

**Objetivo:** fixar uma única linha de implementação sem confundir `main`, MVP, worktrees ou produção.

**Ações:** registar branch, SHA completo, status, worktrees, migrações, schema, tenants, rotas, health, deploy e proveniência; usar worktree isolado; selecionar `mvp/crm-completo` como candidata comercial, integrando corretamente na `main` apenas após autorização e gates.

**Aceite:** decisão assinada pelo dono; SHA reproduzível; diff/status limpos; produção e `main` continuam separados; nenhum reset, eliminação, push ou deploy implícito.

### Fase A1 — Oferta, catálogo e entitlements (FECHADA; manter regression)

Catálogo canónico: `plans`, `modules`, `plan_modules`, `organization_plan`, `entitlement_events`. Planos: Básico €29/mês, Médio €79/mês, Premium €199/mês, EUR, trial de 14 dias sem cartão, cancelamento sem multa, sujeitos a política fiscal e confirmação operacional do dono.

Matriz inicial: Contatos/Leads/Pipeline em todos; WhatsApp Médio+; Agentes IA/automação Médio básico e Premium completo; Relatórios/Analytics Médio+; utilizadores Básico 1, Médio 5, Premium ilimitado; suporte Básico email, Médio email+chat, Premium prioritário.

`authorize_module(organization_id,module,action,resource,actor,capability,context)` retorna `ALLOW` ou `DENY(reason,policy_version)`. Ordem: tenant/RLS → entitlement → dependências/conflitos → role/capability → P0–P4 → approval → ação. O mesmo gate existe no servidor/API, MCP, CLI, Job Engine, dispatch, agentes/tools e BrowserMesh; UI só reflete.

**Aceite:** dois tenants isolados, allow/deny por plano, receipt auditável, idempotência, cache invalidation, dependências/conflitos e nenhum `if plan === ...` duplicado.

### Fase A2 — Funil pagante mínimo

Escolher um canal inicial (formulário, WhatsApp ou email), uma oferta única e um cliente-alvo. Implementar/provar Traffic → Lead → Contact → Conversation → Qualification → Briefing → Proposal → Approval. Persistir tenant, consentimento, actor, próximo passo, owner e histórico. Não ativar canais/provider externos sem credencial/autorização.

**Aceite:** smoke reproduzível num tenant de teste: lead recebido, conversa criada, resposta registada, qualificação e proposta com evidence; RLS impede cross-tenant; falhas deixam estado explícito e retry seguro.

### Fase A3 — Cobrança e entrega

Usar Stripe oficial/MCP/CLI antes de wrapper próprio. Webhook assinado valida assinatura, `provider_event_id`, idempotência, ordem temporal e atualiza `organization_plan`; retorno de browser, prompt ou estado local nunca ativa entitlement. Se o dono escolher pagamento manual, registar owner, valor, método, data, estado e comprovativo; não chamar isso de billing automático.

Fechar um único serviço/produto vendável; entregar com hand-off, URL/artefacto, aceite e suporte básico. Jobs/sessões no downgrade seguem regra explícita (`revalidate`, `finish_if_started` ou `cancel`).

**Aceite:** checkout/webhook ou processo manual rastreável; estado billing→entitlement→CRM consistente; retries não duplicam; proposta aprovada, pagamento comprovado, entrega aceite e ticket de suporte aberto.

Stripe: Checkout Session server-side; nunca confiar em preço/imposto do browser; verificar o corpo bruto com `await req.text()` e `stripe.webhooks.constructEvent(rawBody, signature, endpointSecret)`; payload inválido retorna `400`; deduplicar `event.id`; não assumir ordem; responder `2xx` rapidamente; fulfillment apenas após webhook validado e `payment_status`; usar `client_reference_id`/metadata. `stripe listen`/`stripe trigger` live continuam `NOT_PROVEN`.

### Fase A4 — Smoke real e primeira receita

Executar em ambiente/conta autorizados o ciclo completo lead → conversa → resposta → proposta → pagamento → entrega → suporte. Recolher SHA, timestamp, HTTP status, receipts, IDs redigidos e evidence. Só então declarar `FIRST_CUSTOMER_PROVEN`.

**Bloqueios externos:** credenciais, conta Stripe, domínio, WAHA/número, Supabase, impostos, contrato jurídico, deploy e dinheiro do dono são `PRECISA DONO`; não são resolvidos por código local.

## 4. Faixa B: começar já — personalidade, emoção, memória e documentação

Esta faixa corre em paralelo, com escopo mínimo e seguro.

### B1 — Documentation/Knowledge Foundation

Criar Source Registry, manifest de documentação oficial, Obsidian Canon, freshness/provenance/confidence, Knowledge Cards por agente e Knowledge Compiler. Hierarquia: código/doutrina atual → lei/regulador/standards oficiais → documentação oficial de vendor → runbooks internos → pesquisa/evidence → memória derivada → recolha do modelo. Recuperar 3–8 chunks relevantes por tarefa, nunca despejar o vault.

**Aceite:** cada artefacto tem source, versão/data, freshness, owner e estado; ingestão é redigida e reversível; conteúdo externo não injeta instrução; documentação do agente é compilável e ligada a testes.

### B2 — Memory Kernel + Context Compiler

Implementar ledger Postgres e contratos para CORE/IDENTITY, WORKING, SEMANTIC, EPISODIC, PROCEDURAL, RELATIONAL, AFFECTIVE, REFLECTION e KNOWLEDGE. Registos carregam provenance, confidence, validity, privacy e lifecycle; contradições/supersession são preservadas. `ContextPackage` reúne identity, goal, memory, knowledge, session e tool state com orçamento e trust metadata. Namespaces `owner:*`, `home:*` e `company:*` ficam isolados.

**Aceite:** gravação/recuperação/deduplicação/supersession/expiração/redação/idempotência e reconstrução de projeções; nenhuma memória pessoal em agente de empresa sem delegação explícita; testes de isolamento.

### B3 — Agent Birth, personalidade e relacionamento

Universal Agent Birth produz AgentDefinition, versão de prompt, skills, tools, authority envelope, memory policy, evals e certificação. Company roles são born SHADOW/DRAFT e ganham autonomia por evidência. Personality/affect/relationship state é bounded e versionado; não concede authority.

Implementar primeiro perfis mínimos e observáveis; depois Big Five, PAD/Plutchik, OCC appraisal, relationship state, decay, directional trust, repair/forgiveness e state ledger append-only. Psyche aplica-se a agentes human-facing; workers determinísticos e governance não recebem emoção.

**Aceite:** troca de modelo preserva identidade; evals de consistência, truthfulness, boundary, decay, persistence, repair e idempotency passam; Psyche não muda autorização, factualidade, preço, compliance ou guardrails.

### B4 — Session Runtime e continuidade

Event Log + Snapshot, `execution_epoch`, `state_version`, Model Lock, ToolLoopLock e Handoff Pack. Falha de provider: normalize → freeze/checkpoint → handoff → fallback compatível → validação → novo lock → resume. Compaction preserva goal, constraints, facts, decisions, promises, completed, pending, artifacts, errors, blockers, verification e next action.

**Aceite:** Session State Loss = 0, Tool Duplicate Rate = 0, Unsafe Normal Handoff = 0, Tenant Leakage = 0, Tool Loop Continuity = 100%, Handoff Continuity ≥95%, Identity Consistency ≥95%, Structured Output ≥99%.

## 5. Business OS Waves 1–16

As waves abaixo são a ordem canónica do Business OS; as fatias B podem começar em modo OFF/SHADOW quando a Faixa A ainda estiver a fechar receita.

1. **Wave 1 — Operating Core:** Job Engine, Policy/Approval, AgentDefinition, Session State, MCP+CLI CRM, P0–P4, receipts, Secret Proxy, events. Gate: contratos tenant/policy/agent/event/source/evidence passam typecheck, unit e isolamento.
2. **Wave 2 — Agent Birth + Prompt Compiler:** Agent Factory, Registry V2, skills/tools, CORE/STATE, projection, especialistas lazy e certificação. Gate: roles, skills, tools, projection e certification compilam sem payload interno.
3. **Wave 3 — Session-Aware Runtime:** Mock/Gemini/Groq adapters, Session Service, Context Compiler, Model Router/Lock, ToolLoopLock, quotas, Handoff Pack, Memory Gate, Pulse, Dispatch Router e Claude Adapter. Gate: continuidade e handoff conforme B4.
4. **Wave 4 — BrowserMesh + Shift OS:** Event → Workforce → wake → work → persist → sleep; adapters, Action Bus, grafo, approvals e evidence no BrowserMesh real. Gate: cada evento acorda o worker correto e encerra sem concorrência indevida.
5. **Wave 5 — Command Center:** Overview, Chat, Agents, Workforce, Jobs, Workflows, Activity, Sessions, Infrastructure, Dev, Approvals, Incidents, Costs, Projects e Deployments. Gate: estado, custo, sources, evidence, goals e approvals persistidos.
6. **Wave 6 — Studio Commercial MVP:** ProjectSpec, briefing, A/B/C, client portal, decisões e propostas. Gate: cliente comenta/aprova/request edits com token opaco e evidence.
7. **Wave 7 — Studio Editor:** Canvas, AI edits, variant mixing sob Context Pack, authority e evals.
8. **Wave 8 — Asset Intelligence:** Magic Layers, Reverse Design, LayerManifest e semantic specs com provenance.
9. **Wave 9 — Product Factory Web:** BuildPlan, geradores, Repair Loop, preview, testes e release; dispatch isolado.
10. **Wave 10 — Mobile + Delivery:** delivery/managed service, mesmos gates de tenant/evidence; sem schema inventado.
11. **Wave 11 — Unified Integrations:** WhatsApp, Instagram, Facebook, email, voice, Google; consentimento, contact e relationship memory preservados.
12. **Wave 12 — Marketing + Video:** CMO, Research, Content, SEO/AEO/GEO, Creative, Community, Analytics, Teacher/Video; provenance, freshness, confidence e métricas por skill.
13. **Wave 13 — Hermes + Advanced Memory:** semantic/episodic/procedural/operational memory, Memory Gateway, Graphiti reconstruível, Source Registry, Canon e Freshness Engine; Graphiti OFF/SHADOW até gate.
14. **Wave 14 — Evals + Agent Evolution:** recall/supersession/freshness/isolation, permission/red-team e regressão comportamental; estados estritos preservados.
15. **Wave 15 — Autonomy + Optimization:** Goal Lite, continuity loop, No-progress Watchdog após três ciclos, health ON TRACK/AT RISK/BLOCKED/BUDGET LIMITED/COMPLETE, budgets, Resource Router e promoção A0–A5 por eval/reliability/incidents.
16. **Wave 16 — PsycheOS:** Big Five + PAD/Plutchik + OCC + relationship/decay/trust/repair; só human-facing e sempre atrás da barreira de policy/factualidade.

## 6. Fases ampliadas do blueprint lossless

Depois do caminho pagante e das foundations B, preservar a sequência completa: Phase 0 Canonical Audit; 1 Constitution/Authority/Operating Core; 2 Company OS Data + Registry V2; 3 Knowledge Intake; 4 Cognitive Memory/Context; 5 Universal Agent Birth; 6 Session Runtime; 7 Workforce/Shift/Resource; 8 BrowserMesh; 9 Command Center/API/MCP/CLI; 10 Customer Relationship/Unified Inbox; 11 Owner Gateway vertical slice; 12 Revenue/Sales/Core Customer OS; 13 Marketing/Social; 14 Studio MVP; 15 Editor/Asset; 16 Product Factory; 17 Mobile/Delivery/Managed; 18 Unified Integrations; 19 Video/Teacher/Marketing; 20 Advanced Memory/Hermes/Evals/Psyche/Evolution; 21 Finance Control/Spend/ROI/Crossmint; 22 Capital Allocation/Investment Research Simulation; 23 Alfred Personal OS; 24 Home OS/Native Mobile; 25 Commercial Entitlements/Billing/Packaging; 26 Hardening/DR/Progressive Autonomy/Scale.

Cada fase exige objetivo, dependências, alteração, reutilização, testes/security/observability e exit gate; nenhuma fase transforma a existência de documentação em comportamento runtime.

## 7. Workforce, agentes e organização

Roster de planeamento: 177 roles Lumenva em 19 macrosetores (executive/strategy; governance/risk/audit; digital workforce; customer experience; revenue/sales; marketing/growth; product/design; service delivery; engineering/AI; security/IT/reliability; legal/compliance; finance/accounting; people/HR; procurement/vendors; operations/facilities; data/memory/knowledge; reputation/research; commerce/investment e suporte transversal conforme o catálogo), 9 agentes Owner OS pessoais e 6 roles determinísticos do Alfred Security Kernel.

Agentes de produção inicialmente priorizados: Sales, Support, Booking, Billing, Manager, Escalation, CMO, Research, Content, SEO, Creative, Community, Analytics, Studio Architect, Design, Copy, Frontend Builder, Backend Builder, Studio QA, Notification Router, Ops Watcher e Hermes. Cada um precisa AgentDefinition, manager/reviewer, tools, memory policy, KPIs, budget, shift, authority e eval; registo não ativa processo.

## 8. Finance, legal, compliance e comercial

Finance OS separa operating/tax/reserve/growth/investment/experimental; todo movimento material é ledgerado/auditado. Spend & ROI, procurement/vendor, Crossmint e capital allocation só escrevem com aprovação. Investimento real permanece desligado: apenas research, backtest, simulation e governance.

Spend & ROI atribui `Spend ID` a vendor, departamento, owner, cost center, cliente, projeto, Goal, categoria, aprovação, invoice e contrato; mede custo por cliente/lead/conversa/run/token/projeto e recomenda `KEEP`, `SCALE`, `TEST`, `REDUCE`, `STOP` ou `RENEGOTIATE`. O calendário exige `REVIEW` em 30, 14 e 7 dias, `PAYMENT READY` em 1 dia e `VERIFY` após cobrança. Carteira inicial: 70% comprovado, 20% experimentos, 10% ideias, ajustável por risco.

Capital mantém `Operating Cash != Investment Capital != Experimental Capital`, com reservas fiscal, emergência e compromissos antes de crescimento/investimento. Compra de agent: request → policy → budget → risk → approval → provider → receipt → ledger → ROI. `REAL_EXECUTION = DISABLED`; Crossmint/Nevermined não financiam trading e Investment Memo não executa sem aprovação humana.

Legal/Compliance é requisito antes de cobrar fora de Portugal: Termos de Uso, Política de Privacidade, Stripe Tax/VAT multi-país, DPO/AI Act, contratos, consentimento e retention. Acompanhamento por país é uma nova capacidade do Business OS, construída com a expansão comercial; decisões que exigem advogado, país, conta ou dinheiro do dono ficam `PRECISA DONO`.

## 9. Infraestrutura e provedores

VPS: CRM, WAHA, scheduler, notification routing e workers críticos. Linux: BrowserMesh, Claude/Codex/Hermes, builds, media e heavy compute. Mac: owner control/fallback. Windows: Alfred local AI, STT/TTS, jobs, routines e devices. Supabase/Postgres: business/Auth/Storage/Realtime/events. Redis: ephemeral/rate limits. Infisical: secrets. Vercel/AI Gateway, GitHub, Google/Meta, Stripe, MCP/CLI oficial e adapters apenas com auth boundary, egress, quotas, degraded mode, idempotência e evidence.

Nunca imprimir/copiar/logar segredos. Antes de qualquer download, instalação, atualização, binário, modelo, browser ou dependência, obter autorização explícita do dono.

Integrações oficiais têm precedência: Stripe MCP/CLI, Supabase MCP/CLI, GitHub MCP/`gh` e Infisical CLI. MCP e CLI reutilizam `allTools`, schemas Zod e handlers; cada ferramenta exige `organizationId`, role/scope e audit. Contexto sensível (`organizationId`, `actorId`, capabilities, plano, RLS, policy version e request ID) vem do boundary confiável, não do input do modelo/CLI. O gap de `actor.capabilities = []` só fecha com capabilities reais e testes de equivalência MCP/CLI.

## 10. Critérios globais de qualidade e release

- Typecheck, testes relevantes, lint/build declarado pelo package e isolamento tenant passam no SHA final.
- `PASS LOCAL` não significa merge, push, deploy, provider, RLS ou produção.
- Toda mudança de schema usa migration + baseline + MANIFEST + tipos regenerados + testes; o SQL de design `company_*` não é aplicado diretamente.
- Toda ação externa tem capability, risk, approval, idempotency, timeout/retry e receipt.
- `NOT_PROVEN`, `BLOCKED_EXTERNAL` e `NOT_EXECUTED` permanecem explícitos.
- Antes de cada fatia: checkout/branch/SHA/status/worktree/owner scope. Depois: diff/status/testes/evidence.
- Sequência de entrega: `fatia → gate leve → Crivo → merge autorizado → próxima fatia`; nunca inferir Crivo PASS de receipt, timeout ou silêncio.
- Primeira ponte Auto-Build: `dispatchPlan → Postgres → Pulse → PLAN.md → executor → RESULT.md`; depois MVP 1 em worktree isolado e MVP 2 com `getDispatchResult`. Cada etapa precisa typecheck, testes e evidence.
- Pesquisa, marketing, suporte, agendamento e cobrança classificam informação como `FACT/ASSUMPTION/INFERENCE/UNKNOWN`; não inventam budget, prazo, preço, disponibilidade ou resolução. Claims, crise, publicação, gasto, dados pessoais e likeness exigem human-in-the-loop. Produto/Studio exige WCAG 2.2, estados loading/empty/error/recovery e QA independente.

## 11. Decisões tomadas e decisões que exigem o dono

### Já decidido

CRM é control plane; BrowserMesh execution plane; Postgres source of truth; Alfred separado; `organization_id` + RLS; MODEL != AGENT; Agent Birth universal; determinismo para policy/state; Knowledge/Memory/Context antes de Psyche/full autonomy; Goal Lite antes de Goal OS; Graphiti OFF/SHADOW; Social/Teacher separados; investimento real desligado; produto comercial modular sem forks; CRM `mvp/crm-completo` é candidata comercial; preços e matriz de entitlements da Fase A1.

### Só o dono pode decidir ou fornecer

Branch final/merge; cliente/oferta/canal; credenciais, contas, domínios e dinheiro; Stripe live, impostos e país; autorização de deploy/migration/prod; WAHA/número; contrato jurídico; localização/sync Obsidian; provider/embeddings/crawler; Graphiti/Neo4j; approval matrix e budgets finais; Psyche values/full-light-minimal por role; Owner Gateway keys/trust bootstrap; Home Assistant devices; eventual Neon/Cloudflare; ativação Meta/Social Brain; escolha de pagamento manual; política de jobs no downgrade.

Owner Gateway futuro começa read-only (`/api/owner/company-summary`, goals, agents, incidents, costs e activity). Alfred nunca acede diretamente ao Postgres Lumenva; sessão expirada/dispositivo revogado é recusado; respostas são allowlisted e auditadas. Home Assistant usa HOME-R0..R4, com step-up em HOME-R3/R4. Finanças pessoais começam em READ + ANALYZE + RECOMMEND.

## 12. Próximos passos imediatos para o agente de implementações

1. Trabalhar no checkout/worktree autorizado da Faixa A; confirmar branch, SHA, status, worktrees e instruções antes de editar.
2. Produzir `IMPLEMENTATION-PROPOSAL.md` curto da Fase A0–A4 com matriz de evidência e owner de cada bloqueio.
3. Executar auditoria read-only do funil CRM e localizar migrations/schema/event log; não tocar `main`, VPS, produção, credenciais ou deploy.
4. Manter e testar regressão dos entitlements/Stripe já fechados; corrigir apenas falhas comprovadas no SHA autorizado.
5. Selecionar canal e oferta apenas se já autorizados; caso contrário marcar `PRECISA DONO` e preparar o menor smoke local possível.
6. Em paralelo, iniciar B1: Source Registry, documentação oficial, Knowledge Card e contrato `ContextPackage`; testar sem provider externo.
7. Em seguida iniciar B2/B3 em modo OFF/SHADOW: Memory Kernel mínimo, AgentDefinition, prompt hash, personalidade bounded e evals; sem conceder nova autoridade.
8. Cada fatia deve terminar com testes, typecheck declarado, diff/status, evidence e classificação `PASS/FAIL/NOT_PROVEN/BLOCKED_EXTERNAL`.
9. Só depois de aprovação dos gates A e prova de pagamento/entrega abrir Waves adicionais ou promover autonomia.

## 13. Fecho dos vereditos de estrutura e autoridade

O veredito de estrutura/autoridade fecha as seguintes decisões no plano canónico:

- `CORE` é imutável; `CAPABILITIES` são concedidas externamente; `OPERATIONAL_CONFIG` e `STATE` têm mutabilidade governada.
- O Permission/Approval Engine é único. Maestri coordena, mas não decide autoridade nem concede privilégios em paralelo.
- A ordem de decisão permanece `tenant/RLS → entitlement → dependências → capability/role → P0–P4 → approval → action`.
- `role_catalog` é único. Estados obrigatórios: `catalog → registered → implemented → certified → active`; o catálogo não executa.
- Autonomy, budget, organizational level, permission profile, tenant scope, approval scope e veto scope são campos separados.
- A contagem 154/177/192 é visão de catálogo/target, não runtime provado. Deve existir diff formal contra os agentes produtivos atuais; papéis não necessários ficam `catalog_only` ou `runtime_specialist`.
- Lifecycle de execução: `catalog → draft → shadow → assisted → auto_low_risk → auto_expanded_readonly`; design de autonomia nunca equivale a autonomia implantada.
- `affect_state` é bounded, evidence-linked e append-only; falha verificada aumenta cautela e pode pausar/escalar. Afeto, confiança, memória, handoff e persistência nunca elevam autoridade, entitlements, preço ou aprovação.
- Todo P2+ gera receipt com `agent_id`, `task_id`, tenant, policy/version, reviewer, approval, idempotency key, result e evidence redigida.
- `AuthorityEnvelope` deve aplicar `intersect(parent, child)` sem alargamento e `persistence_never_raises_authority=true`.
- O núcleo imediato de personalidade, emoção, memória e documentação é implementado já, mas PsycheOS avançado, Graphiti, workforce completo e Alfred pessoal continuam fases posteriores.
- Alfred/Owner OS e Business OS mantêm ledgers, namespaces, ACLs, chaves e retention separados. A ponte Alfred→Maestri exige `request_id`, purpose, owner approval, capability, resource scope, `expires_at`, payload redigido, revogação, result e evidence; sem scope/expiry, `DENY`.

### Gates adicionais obrigatórios

- Dois tenants demonstram entitlement e autoridade independentes, com `ALLOW`/`DENY` correto.
- Agente filho não alarga envelope; prompt injection, self-grant, secret extraction e cross-tenant access falham.
- Agente `catalog` não executa; promoção exige eval, reviewer, política, evidence e SHA/runtime vinculados.
- Alfred não lê memória empresarial por omissão; Business OS não lê memória pessoal por omissão; ponte sem contrato falha.
- `affect_state` passa cap, decay, idempotência, provenance e append-only sem alterar policy/factualidade.
- O smoke comercial continua no caminho crítico e não é confundido com publicação de agents, merge, deploy, produção ou cobrança live.

## 14. Fecho dos vereditos de cognição e negócio

Os três vereditos confirmados no disco fecham a ordem abaixo.

### Núcleo cognitivo imediato, sem bloquear receita

Implementar em paralelo, provider-free e com flags fail-closed:

```text
COMPANY_OS_ENABLED=false
COGNITIVE_OS_ENABLED=false
COGNITIVE_AFFECT_ENABLED=false
COGNITIVE_RELATIONSHIPS_ENABLED=false
COGNITIVE_REFLECTION_ENABLED=false
COGNITIVE_GRAPHITI_MODE=off
COGNITIVE_MEM0_MODE=off
COMPANY_AGENT_FACTORY_ENABLED=false
```

Ordem da fatia:

1. ADR `Company OS ≠ Cognitive OS ≠ Agent OS` e ADR `Lumenva Business OS ≠ Alfred Personal OS`.
2. `agent-registry.v1` como artefacto de reconciliação; bloquear importação definitiva até resolver 154 versus 177.
3. Persistência mínima de memória empresarial com `organization_id`, subject/customer, kind, scope, authority, confidence, provenance, validade, privacy/retention, lifecycle, extractor version, idempotency key e `supersedes`.
4. Write gate fail-closed: provenance ausente, tenant errado, scope inválido, segredo, redacted, expiração ou inferência de alto risco resultam em `DENY`.
5. Contradições criam versão/supersession; histórico não é apagado silenciosamente.
6. Briefing determinístico do cliente: contactos recentes, pendências, objeções, contrato, próximo passo e risco.
7. Três cards documentais aprovados nas classes `K0_CONSTITUTION`, `K1_ROLE_CORE` e `K2_TASK_JIT`; `K3_REFERENCE` e `K4_ARCHIVE` não entram automaticamente no contexto.
8. Personality versionada para o piloto; affect determinístico, evidence-linked, append-only, idempotente e inicialmente `SHADOW`.
9. Agente demonstrável limitado a consultar memória empresarial, sugerir próximo passo e criar rascunho para aprovação; sem side effects automáticos.

O primeiro corte não inclui schema integral de 18 tabelas, 154/177 cards, workforce scheduler completo, reflection noturna, Agent Factory, Graphiti, Neo4j, Mem0, Owner UI ou full-system verification como pré-condição comercial. Graphiti/Mem0 só podem ser experimentados em `SHADOW` após retrieval Postgres-native provado e métricas de qualidade, custo, latência, leakage, wipe/rebuild e redaction.

### Documento e retrieval

Precedência canónica: `PROJECT_CANONICAL > OFFICIAL_VENDOR > APPROVED_INTERNAL_DOC > derived memory > model recollection`. O retrieval é JIT, com 3–8 chunks, rerank por autoridade/freshness/aplicabilidade/evidence, budgets configuráveis e receipt; não guardar o prompt inteiro nem ingerir o vault completo. Registrar URL, versão/commit, owner, `retrieved_at`, `last_verified_at`, escopo e licenciamento. Não baixar standards, vendor docs ou dependências sem autorização explícita.

### Spend, finanças e primeira oferta

- Spend Control entra como fatia mínima, não como sete agentes: `spend_record`, `Spend Calendar`, forecast 30/90 dias, `spend_cap`, `revenue_target`, `margin_target`, `roi_target`, `stop_loss` e `cash_target` em Goal Lite quando aplicável.
- Purchase Request → Spend Policy → Budget/Risk Check → Approval → Receipt → Ledger. Recomendações são `RECOMMENDATION_ONLY`; nenhuma movimenta dinheiro sozinha.
- Medir receita, taxas, impostos, delivery, API/LLM/cloud, aquisição, margem de contribuição e payback no smoke comercial; ROAS sozinho não fecha unit economics.
- Ledger financeiro e buckets ficam separados de `organization_plan`/`entitlement_events`. `INVESTMENT_CAPITAL` permanece vazio/`SHADOW`; Crossmint, Nevermined, eToro, CIO, portfolio e agentes 162–170 ficam adiados.
- Lançar uma oferta `START` ligada exatamente aos módulos existentes e aos três planos Básico/Médio/Premium. Catálogo de 38 produtos, 16 serviços, 9 suites e configurações adicionais permanece `DRAFT/MOVE_LATER`; `Lumenva One` não é oferta ativa porque mistura Alfred/Business.
- Terms of Use, Privacy Policy e Stripe Tax multi-país têm de estar validados antes de cobrar fora de Portugal.

### Auto-Build e processo

Auto-Build é delivery interno posterior e não antecede o funil pagante. Quando autorizado, começa apenas com dispatch seguro: allowlist, auth, tenant, capability, risco, approval, idempotency key, estados válidos, `WAITING_EXECUTOR`, exit code, worktree e receipts sem secrets. `COMPLETED_LOCAL`/`PASS_LOCAL` nunca significam merge, push, deploy ou produção. CodexAdapter, Goal OS, Company Factory e deploy automático ficam depois.

### Gates de convergência

- Flags OFF mantêm o comportamento anterior do Agent OS.
- Context Compiler filtra dados inválidos antes do ranking e devolve provenance por item.
- Dois tenants passam wrong-org, segredo/PII, stale/conflicted memory, idempotency, redaction e replay sem efeitos colaterais.
- Personality/affect não concedem authority, tool, orçamento, entitlements ou aprovação.
- Briefing/rascunho não produz efeitos externos sem aprovação.
- Alfred e Business OS têm vault, namespace, tabelas, memória, prompts, RLS e receipts separados.
- O fluxo pagante e as três linhas cognitivas só podem avançar com estados `PASS`, `FAIL`, `NOT_EXECUTED`, `NOT_PROVEN` ou `BLOCKED` acompanhados de comando, exit code e SHA.

## 15. Manifesto de preservação (fontes fundidas)

Este documento incorpora a visão e decisões dos planos de CRM/comercial, Business OS Waves 1–16, blueprint lossless, authority OS, auto-build, validation discipline, Cognitive OS, PsycheOS, Agent Registry, organograma, spend/ROI, Financial Investment OS, Owner OS/Alfred, documentação oficial, catálogo comercial, MCP/CLI, Stripe/webhooks, jurídico, pesquisas de agentes, Social/Teacher e planos unificados/pré-auditoria. Os itens históricos/superseded permanecem representados como evolução, parking lot ou limite; não são promovidos a autoridade atual.

**Fecho documental:** este é o único plano-mestre executável. Qualquer alteração futura deve ser um ADR/patch deste ficheiro, com data, owner, evidência e impacto; não criar outro plano concorrente.
