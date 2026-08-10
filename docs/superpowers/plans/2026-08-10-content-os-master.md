# Content OS Implementation Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o Content Operations OS da Lumenva dentro do CRM existente, mantendo PostgreSQL como fonte da verdade e integrando Postiz, RSSHub, changedetection.io, ComfyUI e um Video Composer através de boundaries substituíveis.

**Architecture:** O domínio Content OS vive no monorepo Next.js existente e usa Supabase/Postgres, RLS, `event_log` e workers canónicos. Engines externos ficam em rede privada e são acedidos exclusivamente por adapters tipados; browser/mobile fala apenas com `/api/v1/`. O trabalho é dividido em subplanos independentes para permitir revisão, teste e rollback por domínio.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, Supabase/Postgres, Zod, Upstash Redis, Sentry, Vitest, Playwright, pnpm 9.15.9, Node >=22.

## Global Constraints

- Trabalhar somente na branch `gpt-lumenva-content-os`.
- Não alterar `main`, não fazer merge e não criar PR sem nova instrução explícita.
- `CLAUDE.md` e `.claude/rules/` continuam a ser doutrina superior.
- Toda tabela tenant-aware usa `organization_id`, RLS e teste cross-tenant.
- Mudança de schema sai em tripla: migration + `supabase/baseline.sql` + `supabase/migrations/MANIFEST.md`.
- `lib/database.types.ts` é regenerado; nunca editado manualmente.
- API pública usa `/api/v1/`, JSON `snake_case`, `ok()`/`fail()`, Zod e `X-Request-Id` canónico.
- POST de criação com side effect usa `Idempotency-Key` quando coberto pelo contrato base.
- Trigger Postgres nunca faz HTTP.
- Nenhum dos cinco engines é acedido directamente pelo browser/mobile.
- Código de domínio não importa SDK/módulo concreto dos engines; só interfaces do boundary.
- Não adicionar serviço pago obrigatório ao self-host sem decisão explícita de produto.
- Postiz/RSSHub/ComfyUI/changedetection.io têm gates jurídicos/licenciamento antes de SaaS a terceiros.
- MoneyPrinterTurbo é base transitória para extrair um `video-composer` próprio.

---

## Decomposição oficial

Este master plan não deve ser executado como uma única alteração. Cada subplano produz software funcional e testável por si próprio.

| Ordem | Subplano | Resultado |
|---:|---|---|
| 1 | `2026-08-10-content-os-foundation.md` | domínio, schema, provider contracts, jobs, health, event boundaries |
| 2 | `2026-08-10-content-os-intelligence.md` | Radar de Notícias + Radar de Concorrentes via RSSHub/changedetection |
| 3 | `2026-08-10-content-os-creative.md` | Creative jobs, ComfyUI adapter, assets e Video Composer |
| 4 | `2026-08-10-content-os-distribution.md` | conexões sociais, publication jobs e Postiz adapter |
| 5 | `2026-08-10-content-os-product-ui.md` | dashboard, criação, criadores, roteiros, hooks, calendário e mobile |

---

### Task 1: Baseline e mapa de impacto

**Files:**
- Read: `CLAUDE.md`
- Read: `.claude/rules/*.md` conforme domínio
- Read: `docs/specs/17-spec-content-os.md`
- Read: `docs/current-state.md`
- Read: `docs/testing/user-journey-map.md`

**Interfaces:**
- Consumes: doutrina canónica e Spec 17.
- Produces: baseline verificável antes da primeira alteração funcional.

- [ ] **Step 1: Confirmar branch e árvore limpa**

```bash
git branch --show-current
git status --short
```

Expected: branch `gpt-lumenva-content-os`; nenhum ficheiro inesperado modificado.

- [ ] **Step 2: Executar gate rápido existente**

```bash
pnpm gov:verify
```

Expected: exit 0. Se falhar antes de mudanças Content OS, registar como baseline failure e não atribuir a implementação nova.

- [ ] **Step 3: Executar testes de banco antes de migrations novas**

```bash
pnpm test:db
```

Expected: exit 0 ou baseline failure documentada com evidência.

- [ ] **Step 4: Registar SHA base no primeiro commit de implementação**

```bash
git rev-parse HEAD
```

Expected: SHA guardado no handoff/commit da primeira onda, não inventado em documentação estática.

---

### Task 2: Executar Foundation

**Files:**
- Plan: `docs/superpowers/plans/2026-08-10-content-os-foundation.md`

**Interfaces:**
- Consumes: Spec 17.
- Produces: contratos e persistência usados por todos os subplanos seguintes.

- [ ] **Step 1: Executar o subplano Foundation integralmente**

Usar `superpowers:subagent-driven-development` por task, ou `superpowers:executing-plans` em batches pequenos.

- [ ] **Step 2: Verificar gates da Foundation**

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm build
```

Expected: exit 0 nos checks aplicáveis, com resultados recentes.

- [ ] **Step 3: Só avançar se contracts e schema estiverem estáveis**

Critério: nenhum subplano seguinte pode definir uma segunda versão de `IntelligenceProvider`, `CreativeProvider`, `VideoComposer` ou `DistributionProvider`.

---

### Task 3: Executar Intelligence

**Files:**
- Plan: `docs/superpowers/plans/2026-08-10-content-os-intelligence.md`

**Interfaces:**
- Consumes: provider contracts + `content_sources`, `content_signals`, `competitor_*`.
- Produces: sinais normalizados e oportunidades consumíveis pela UI/AI.

- [ ] **Step 1: Implementar RSSHub primeiro**

Critério: uma fonte controlada gera `content_signals` deduplicados sem acesso directo do browser ao RSSHub.

- [ ] **Step 2: Implementar changedetection.io segundo**

Critério: alteração de página produz `competitor_events` normalizado sem tornar o datastore externo fonte de verdade.

- [ ] **Step 3: Executar gates específicos**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:db
pnpm test:e2e --grep "Content OS Intelligence"
pnpm build
```

Expected: testes relevantes passam; qualquer teste externo indisponível fica explicitamente separado de teste de domínio.

---

### Task 4: Executar Creative

**Files:**
- Plan: `docs/superpowers/plans/2026-08-10-content-os-creative.md`

**Interfaces:**
- Consumes: `CreativeProvider`, `VideoComposer`, `content_assets`, `creative_jobs`.
- Produces: assets persistidos no Storage canónico e jobs recuperáveis.

- [ ] **Step 1: Implementar ComfyUI como worker privado**

Critério: Content OS cria job local, adapter submete workflow, worker reconcilia estado e copia output final para Storage.

- [ ] **Step 2: Implementar MPT-derived Video Composer**

Critério: composição consome roteiro/assets normalizados; nenhuma configuração global do MPT é exposta ao cliente.

- [ ] **Step 3: Validar cancelamento, retry e restart**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:db
pnpm test:e2e --grep "Content OS Creative"
pnpm build
```

Expected: jobs locais mantêm estado coerente quando provider falha/reinicia.

---

### Task 5: Executar Distribution

**Files:**
- Plan: `docs/superpowers/plans/2026-08-10-content-os-distribution.md`

**Interfaces:**
- Consumes: `DistributionProvider`, `distribution_connections`, `publication_jobs`.
- Produces: conexão social e publicação idempotente via Postiz.

- [ ] **Step 1: Implementar connection mapping por tenant**

Critério: cada ligação Content OS aponta para organização/conexão Postiz sem expor token ao browser.

- [ ] **Step 2: Implementar publication job idempotente**

Critério: timeout/retry não cria publicação duplicada para a mesma operação local.

- [ ] **Step 3: Implementar sincronização de estado/métricas**

Critério: provider state é normalizado no Content OS; ausência do Postiz não apaga histórico local.

- [ ] **Step 4: Executar gates**

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm test:e2e --grep "Content OS Distribution"
pnpm build
```

Expected: publicação real controlada ou sandbox prova o side effect antes de marcar a integração como pronta.

---

### Task 6: Executar Product UI

**Files:**
- Plan: `docs/superpowers/plans/2026-08-10-content-os-product-ui.md`

**Interfaces:**
- Consumes: APIs e domínio dos quatro subplanos anteriores.
- Produces: experiência unificada desktop/mobile.

- [ ] **Step 1: Dashboard operacional**

Entregar visão de oportunidades, jobs, calendário, alertas e estado de providers sem iframes dos engines externos.

- [ ] **Step 2: Fluxo Descobrir → Decidir → Criar → Aprovar → Publicar**

Entregar uma jornada E2E que atravessa os módulos sem o utilizador precisar conhecer RSSHub/Comfy/Postiz.

- [ ] **Step 3: Mobile responsivo**

Cobrir consulta, aprovação, calendário, alertas, roteiro e publicação em viewport mobile.

- [ ] **Step 4: QA visual e acessibilidade**

```bash
pnpm test:e2e --grep "Content OS"
pnpm test:journeys
pnpm build
```

Expected: jornada principal validada com browser real, medidas de layout e evidência canónica.

---

### Task 7: Learning loop e memória derivada

**Files:**
- Create/Modify: definido em plano futuro específico quando as fases 1–5 tiverem telemetria real.
- Read: `docs/specs/17-spec-content-os.md`

**Interfaces:**
- Consumes: `content_learning_events`, métricas e decisões reais.
- Produces: baseline/evals e, só depois, projecções de memória/grafo.

- [ ] **Step 1: Criar golden dataset antes de Mem0/Graphiti hot path**

Dataset deve conter decisões e resultados reais/anonimizados suficientes para medir regressão.

- [ ] **Step 2: Medir baseline com tracing/evals**

Não activar memória derivada sem uma métrica comparável.

- [ ] **Step 3: Activar Mem0 em `shadow`**

Critério: escrita/leitura não influencia produção; apenas comparação.

- [ ] **Step 4: Evoluir `shadow → canary → on` com kill switch**

Critério: flag por tenant + kill switch global e replay/rebuild testado.

---

### Task 8: Gate jurídico e de release SaaS

**Files:**
- Create: `docs/legal/content-os-open-source-gate.md` quando houver parecer/decisão real.
- Modify: release checklist apropriado apenas após decisão jurídica.

**Interfaces:**
- Consumes: inventário dos cinco engines.
- Produces: decisão explícita de exposição comercial.

- [ ] **Step 1: Rever Postiz AGPL**
- [ ] **Step 2: Rever RSSHub AGPL**
- [ ] **Step 3: Rever ComfyUI GPLv3**
- [ ] **Step 4: Esclarecer changedetection.io hosting/commercial terms**
- [ ] **Step 5: Confirmar preservação de notices MIT no código derivado do MPT**

Expected: nenhuma afirmação jurídica inventada por agente; release SaaS bloqueado até decisão humana/profissional registada.

---

## Ordem de execução e dependências

```text
Foundation
   │
   ├──── Intelligence ─────┐
   ├──── Creative ─────────┼── Product UI ── Learning Loop
   └──── Distribution ─────┘

Legal Gate ────────────────────────────────► SaaS release
```

Intelligence, Creative e Distribution podem avançar em paralelo **depois** da Foundation, porque partilham apenas contratos estáveis e não dependem entre si.

---

## Definition of Done do programa

O Content OS V1 só pode ser declarado concluído quando houver evidência recente de:

```bash
pnpm harness:check
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm test:e2e
pnpm build
```

Além dos comandos:

- jornada principal desktop validada;
- jornada mobile validada;
- isolamento cross-tenant provado;
- publicação idempotente provada;
- provider outage/retry demonstrado;
- assets persistidos no Storage canónico;
- nenhum engine exposto directamente;
- documentação/spec actualizada;
- riscos/licenças restantes explicitamente registados.
