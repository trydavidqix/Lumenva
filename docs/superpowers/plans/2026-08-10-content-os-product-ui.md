# Content OS Product UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a experiência unificada do Content OS — dashboard, criação, criadores, radares, roteiros, hooks, media, calendário/publicação e mobile — sem expor a complexidade dos engines externos.

**Architecture:** A UI usa apenas APIs `/api/v1/content-os/*` e componentes do design system canónico. O fluxo principal é Descobrir → Decidir → Criar → Aprovar → Publicar → Medir → Aprender. Desktop é completo; mobile é uma superfície oficial responsiva para acompanhamento e acções críticas.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Tailwind, shadcn/ui/Radix, TanStack Query, Phosphor icons, Playwright, axe.

## Global Constraints

- Foundation + APIs de Intelligence/Creative/Distribution disponíveis antes de ligar fluxos reais.
- Não embutir iframes/UI do Postiz, RSSHub, changedetection.io, ComfyUI ou MPT.
- Seguir `docs/design-system/` e `apps`/component patterns existentes.
- Server-side auth/RBAC continua obrigatório; esconder botão não substitui autorização.
- Mobile não é versão amputada para estados críticos: aprovação, alertas, calendário e publicação precisam funcionar.

---

## File structure

**Create**
- `app/app/content-os/page.tsx`
- `app/app/content-os/_client.tsx`
- `app/app/content-os/radar/page.tsx`
- `app/app/content-os/competitors/page.tsx`
- `app/app/content-os/create/page.tsx`
- `app/app/content-os/scripts/page.tsx`
- `app/app/content-os/hooks/page.tsx`
- `app/app/content-os/creators/page.tsx`
- `app/app/content-os/media/page.tsx`
- `app/app/content-os/calendar/page.tsx`
- `components/content-os/ContentOsShell.tsx`
- `components/content-os/OpportunityCard.tsx`
- `components/content-os/JobStatus.tsx`
- `components/content-os/ContentEditor.tsx`
- `components/content-os/ApprovalPanel.tsx`
- `components/content-os/CreatorCard.tsx`
- `components/content-os/ScriptCard.tsx`
- `components/content-os/HookLibrary.tsx`
- `components/content-os/MediaGrid.tsx`
- `components/content-os/PublicationCalendar.tsx`
- `lib/content-os/ui/query-keys.ts`
- `tests/e2e/content-os-main-journey.spec.ts`
- `tests/e2e/content-os-mobile.spec.ts`

**Modify**
- `lib/navigation/registry.ts`
- `docs/testing/user-journey-map.md`

---

### Task 1: Content OS navigation + shell

**Files:**
- Create: `app/app/content-os/page.tsx`
- Create: `app/app/content-os/_client.tsx`
- Create: `components/content-os/ContentOsShell.tsx`
- Modify: `lib/navigation/registry.ts`
- Create: `components/content-os/ContentOsShell.test.tsx`

**Interfaces:**
- Produces: canonical Content OS route tree and product navigation.

- [ ] **Step 1: Write failing navigation test**

Assert routes exist for overview, radar, competitors, create, scripts, hooks, creators, media and calendar, and that navigation uses the repository's existing registry rather than a second hard-coded sidebar.

- [ ] **Step 2: Implement navigation entries**

Use product-facing labels; provider names do not appear in primary navigation.

- [ ] **Step 3: Implement shell**

Shell provides section navigation, workspace context, global job/alert indicator and mobile navigation treatment using existing design system primitives.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run components/content-os/ContentOsShell.test.tsx
pnpm typecheck
pnpm lint
git add app/app/content-os components/content-os/ContentOsShell.tsx components/content-os/ContentOsShell.test.tsx lib/navigation/registry.ts
git commit -m "feat(content-os): add product shell and navigation"
```

---

### Task 2: Operational dashboard

**Files:**
- Modify: `app/app/content-os/_client.tsx`
- Create: `components/content-os/OpportunityCard.tsx`
- Create: `components/content-os/JobStatus.tsx`
- Create: `components/content-os/ContentOsOverview.test.tsx`

**Interfaces:**
- Consumes: opportunities, upcoming publications, provider/job health and recent performance.
- Produces: dashboard operational, not vanity dashboard.

- [ ] **Step 1: Write failing component tests**

Test loading, empty, degraded provider, failed job and populated states.

- [ ] **Step 2: Implement priority blocks**

Display:

```text
Oportunidades a decidir
Conteúdos em produção
Aprovações pendentes
Publicações próximas
Alertas/falhas
Performance recente
```

- [ ] **Step 3: No provider jargon in normal state**

Use “Publicação indisponível”/“Geração temporariamente indisponível”; provider name may appear only in technical detail surface for authorised operators.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run components/content-os/ContentOsOverview.test.tsx
pnpm typecheck
pnpm lint
git add app/app/content-os/_client.tsx components/content-os
git commit -m "feat(content-os): add operational dashboard"
```

---

### Task 3: Radar de Notícias + Radar de Concorrentes UI

**Files:**
- Create: `app/app/content-os/radar/page.tsx`
- Create: `app/app/content-os/competitors/page.tsx`
- Create: `components/content-os/RadarFeed.tsx`
- Create: `components/content-os/CompetitorMonitorList.tsx`
- Create matching component tests.

**Interfaces:**
- Consumes: Intelligence APIs.
- Produces: discovery → opportunity decision.

- [ ] **Step 1: Write failing tests for source/feed states**

Cover signal list, deduped entries, disabled source, monitor failure and no data.

- [ ] **Step 2: Implement Radar feed**

Actions: `Guardar`, `Ignorar`, `Criar oportunidade`, `Abrir origem`. Do not show raw RSS/HTML payload by default.

- [ ] **Step 3: Implement competitor monitor list**

Show competitor, monitored pages, last check, last meaningful change and health.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run components/content-os/RadarFeed.test.tsx components/content-os/CompetitorMonitorList.test.tsx
pnpm typecheck
pnpm lint
git add app/app/content-os/radar app/app/content-os/competitors components/content-os/RadarFeed.tsx components/content-os/CompetitorMonitorList.tsx
git commit -m "feat(content-os): add intelligence radar ui"
```

---

### Task 4: Content creation workspace

**Files:**
- Create: `app/app/content-os/create/page.tsx`
- Create: `components/content-os/ContentEditor.tsx`
- Create: `components/content-os/ApprovalPanel.tsx`
- Create tests for both components.

**Interfaces:**
- Consumes: opportunity/idea/hook/script/assets.
- Produces: versioned `content_items` and approval actions.

- [ ] **Step 1: Write editor tests**

Cover new draft from opportunity, autosave state, dirty state, validation error, content version switch and approval status.

- [ ] **Step 2: Implement editor sections**

```text
Objectivo
Canal/formato
Hook
Roteiro/copy
Assets
CTA
Notas
Estado/aprovação
```

- [ ] **Step 3: Implement explicit AI actions**

AI generation is action-oriented: `Gerar opções`, `Reescrever`, `Criar variações`, `Adaptar canal`; user can always inspect/edit result before approval.

- [ ] **Step 4: Implement approval panel**

Support `Rascunho → Em revisão → Aprovado → Agendado/Publicação`, with audit-friendly actor/time.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run components/content-os/ContentEditor.test.tsx components/content-os/ApprovalPanel.test.tsx
pnpm typecheck
pnpm lint
git add app/app/content-os/create components/content-os/ContentEditor.tsx components/content-os/ApprovalPanel.tsx
git commit -m "feat(content-os): add creation workspace"
```

---

### Task 5: Scripts and Hook Library

**Files:**
- Create: `app/app/content-os/scripts/page.tsx`
- Create: `app/app/content-os/hooks/page.tsx`
- Create: `components/content-os/ScriptCard.tsx`
- Create: `components/content-os/HookLibrary.tsx`
- Create tests.

**Interfaces:**
- Produces: reusable content IP inside tenant, not loose text snippets.

- [ ] **Step 1: Write failing filter/search tests**

Scripts filter by status/channel/campaign; hooks filter by category/funnel/channel/performance.

- [ ] **Step 2: Implement script versioning surface**

Show current version, approval status, linked content items/assets and performance when available.

- [ ] **Step 3: Implement hook library**

Hook card includes hook text, category, intended use, usage count and performance signal where measured.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run components/content-os/ScriptCard.test.tsx components/content-os/HookLibrary.test.tsx
pnpm typecheck
pnpm lint
git add app/app/content-os/scripts app/app/content-os/hooks components/content-os/ScriptCard.tsx components/content-os/HookLibrary.tsx
git commit -m "feat(content-os): add scripts and hook library"
```

---

### Task 6: Creator Hub

**Files:**
- Create: `app/app/content-os/creators/page.tsx`
- Create: `components/content-os/CreatorCard.tsx`
- Create: `components/content-os/CreatorCard.test.tsx`

**Interfaces:**
- Consumes: creator profiles + assignments.
- Produces: searchable creator centre connected to campaigns/content.

- [ ] **Step 1: Write failing creator state tests**

Cover available/assigned/inactive creator, missing profile data and tenant isolation through API fixture.

- [ ] **Step 2: Implement creator card/list**

Show role/speciality, channels, audience/location fields supported by schema, assignments and recent content/performance. Do not invent unverified social metrics.

- [ ] **Step 3: Implement assignment action**

Assignment links creator to campaign/content item through domain API, not client-only state.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run components/content-os/CreatorCard.test.tsx
pnpm typecheck
pnpm lint
git add app/app/content-os/creators components/content-os/CreatorCard.tsx components/content-os/CreatorCard.test.tsx
git commit -m "feat(content-os): add creator hub"
```

---

### Task 7: Media Studio + jobs

**Files:**
- Create: `app/app/content-os/media/page.tsx`
- Create: `components/content-os/MediaGrid.tsx`
- Create: `components/content-os/MediaGrid.test.tsx`

**Interfaces:**
- Consumes: Creative APIs/content assets.
- Produces: asset library and generation/composition controls.

- [ ] **Step 1: Write job-state tests**

Cover queued/running/succeeded/failed/cancelled and provider outage.

- [ ] **Step 2: Implement media grid**

Canonical Storage asset is the item shown. Temporary provider output URLs are never treated as durable asset URLs.

- [ ] **Step 3: Implement generation actions**

Start image/video jobs from approved workflow presets and structured parameters. No arbitrary Comfy workflow upload in V1.

- [ ] **Step 4: Implement retry/cancel UX**

Only show retry for domain-safe states; cancellation uses API and reflects asynchronous cancellation honestly.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run components/content-os/MediaGrid.test.tsx
pnpm typecheck
pnpm lint
git add app/app/content-os/media components/content-os/MediaGrid.tsx components/content-os/MediaGrid.test.tsx
git commit -m "feat(content-os): add media studio"
```

---

### Task 8: Calendar + publication surface

**Files:**
- Create: `app/app/content-os/calendar/page.tsx`
- Create: `components/content-os/PublicationCalendar.tsx`
- Create: `components/content-os/PublicationCalendar.test.tsx`

**Interfaces:**
- Consumes: publication jobs/connections.
- Produces: calendar and publish/schedule UX.

- [ ] **Step 1: Write failing calendar tests**

Cover scheduled, published, failed, conflict/no active connection and timezone display.

- [ ] **Step 2: Implement calendar**

Use tenant/user timezone presentation while persisting/transporting ISO UTC.

- [ ] **Step 3: Implement schedule/publish action**

Generate fresh `Idempotency-Key` per intended new publication. UI retry of same pending operation reuses the local operation identity instead of creating a second publish.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run components/content-os/PublicationCalendar.test.tsx
pnpm typecheck
pnpm lint
git add app/app/content-os/calendar components/content-os/PublicationCalendar.tsx components/content-os/PublicationCalendar.test.tsx
git commit -m "feat(content-os): add publication calendar"
```

---

### Task 9: Desktop E2E main journey

**Files:**
- Create: `tests/e2e/content-os-main-journey.spec.ts`
- Modify: `docs/testing/user-journey-map.md`

- [ ] **Step 1: Build one deterministic end-to-end journey**

```text
signal → opportunity → draft → hook/script → asset → approval → schedule → publication state → metrics
```

- [ ] **Step 2: Assert failure recovery in the same suite**

At least one provider failure must become a visible recoverable state.

- [ ] **Step 3: Run browser proof**

```bash
pnpm test:e2e --grep "Content OS main journey"
```

- [ ] **Step 4: Update journey map and commit**

```bash
git add tests/e2e/content-os-main-journey.spec.ts docs/testing/user-journey-map.md
git commit -m "test(content-os): cover main content journey"
```

---

### Task 10: Mobile E2E + accessibility

**Files:**
- Create: `tests/e2e/content-os-mobile.spec.ts`
- Modify: `docs/testing/user-journey-map.md`

- [ ] **Step 1: Test mobile viewport**

Use a project/device viewport aligned with the existing Playwright config. Cover dashboard, radar, approval, calendar and publication action.

- [ ] **Step 2: Measure layout rather than eyeballing**

Assert no horizontal overflow and critical controls remain within viewport/reachable.

- [ ] **Step 3: Run axe on critical pages**

Use installed `@axe-core/playwright`; fail on serious/critical violations unless an existing documented exception applies.

- [ ] **Step 4: Verify**

```bash
pnpm test:e2e --grep "Content OS mobile"
pnpm test:journeys
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/content-os-mobile.spec.ts docs/testing/user-journey-map.md
git commit -m "test(content-os): cover mobile and accessibility"
```

---

### Task 11: Product UI final gate

- [ ] **Step 1: Run full relevant suite**

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

- [ ] **Step 2: Inspect responsive evidence**

Validate desktop and mobile screenshots/traces through the established evidence workflow.

- [ ] **Step 3: Verify no provider leakage**

Search UI copy and browser network calls: user-facing surface must not directly call or require Postiz/RSSHub/changedetection/ComfyUI/MPT hosts.
