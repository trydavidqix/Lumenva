# Lumenva Radar Implementation Plan

> **For agentic workers:** REQUIRED EXECUTION MODE: use `superpowers:executing-plans` and execute this plan **inline in the current session**. **Subagents are forbidden by user instruction.** Track progress with the checkbox (`- [ ]`) syntax below.

**Goal:** Build and fully validate the Lumenva Radar editorial hub inside the existing `website/` app at `lumenva.pt/radar`, using only existing/free capabilities, while keeping the Social integration as a later seam rather than a V1 dependency.

**Architecture:** Radar is a file-backed, typed editorial subsystem inside the current Next.js website. It reuses the existing Lumenva design system, layout and telemetry, adds dedicated Radar routes/components/content helpers, generates SEO/sitemap/RSS from the same typed content source, and keeps all publishing data local to the repository for V1.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, CSS Modules + existing semantic tokens, Vitest, Testing Library, Playwright, existing Vercel Analytics/Speed Insights, existing Resend/rate-limit facilities only where already configured.

**Spec:** `docs/superpowers/specs/2026-09-07-lumenva-radar-design.md`

## Global Constraints

- Work only on branch `blog`.
- Do not merge, rebase into, force-update or directly modify `main`.
- Execute everything inline; do not dispatch subagents.
- Autonomy is granted to create/edit/delete/refactor/test/document files needed for this Radar scope without requesting per-file approval.
- No paid service, paid API, paid CMS, paid search engine, paid analytics tool, paid image provider or paid newsletter dependency may be introduced.
- Prefer existing dependencies; new dependency installation requires a strong technical need and must be free/open-source. The default is **no new dependency**.
- `lumenva-social` is not a runtime dependency of Radar V1.
- Reuse `website/DESIGN.md`, `website/styles/tokens.css`, existing header/footer and Manrope setup.
- Lumenva palette is black/gray/white only. No chromatic accent or arbitrary local hex values.
- Never fabricate company metrics, readership counts, testimonials, customers, product facts or social proof.
- Use TDD for behavior-bearing helpers/components/routes: failing focused test first, then minimum implementation, then broader gate.
- Make small, reviewable commits after each independently green task.
- Any external-service feature that is not already configured must fail honestly and must not block the rest of Radar from shipping.

---

## Planned File Map

### Core content/domain

- Create `website/lib/radar/types.ts` — canonical Radar TypeScript contracts.
- Create `website/lib/radar/articles.ts` — article registry/query functions.
- Create `website/lib/radar/search.ts` — local normalized search.
- Create `website/lib/radar/related.ts` — deterministic related-content ranking.
- Create `website/lib/radar/metadata.ts` — canonical URLs, metadata and JSON-LD helpers.
- Create `website/lib/radar/rss.ts` — RSS serialization.
- Create `website/content/radar/articles.ts` — representative file-backed Radar content registry.
- Create `website/content/radar/quick.ts` — Radar Rápido dataset.

### UI

- Create `website/components/radar/RadarHero.tsx` + `.module.css`.
- Create `website/components/radar/FeaturedArticle.tsx` + `.module.css`.
- Create `website/components/radar/CategoryNav.tsx` + `.module.css`.
- Create `website/components/radar/ArticleCard.tsx` + `.module.css`.
- Create `website/components/radar/ArticleList.tsx` + `.module.css`.
- Create `website/components/radar/QuickRadar.tsx` + `.module.css`.
- Create `website/components/radar/TrendingTopics.tsx` + `.module.css`.
- Create `website/components/radar/RadarSearch.tsx` + `.module.css`.
- Create `website/components/radar/NewsletterCTA.tsx` + `.module.css`.
- Create `website/components/radar/ArticleBody.tsx` + `.module.css`.
- Create `website/components/radar/ArticleSources.tsx` + `.module.css`.
- Create `website/components/radar/ShareActions.tsx` + `.module.css`.
- Create `website/components/radar/RelatedArticles.tsx` + `.module.css`.

### Routes

- Create `website/app/radar/page.tsx` + `page.module.css`.
- Create `website/app/radar/[slug]/page.tsx` + `page.module.css`.
- Create `website/app/radar/noticias/page.tsx`.
- Create `website/app/radar/insights/page.tsx`.
- Create `website/app/radar/guias/page.tsx`.
- Create `website/app/radar/categoria/[slug]/page.tsx`.
- Create `website/app/radar/rss.xml/route.ts`.
- Optional after core green: create `website/app/api/radar/articles/route.ts` as read-only public metadata seam.

### Existing files to modify

- Modify `website/components/layout/Header.tsx` — add Radar navigation entry using existing pattern.
- Modify `website/components/layout/MobileNavigation.tsx` — add Radar entry.
- Modify `website/components/layout/Footer.tsx` — add Radar link if current information architecture permits.
- Modify `website/content/site.ts` — register Radar in canonical site navigation/public routes if that file owns them.
- Modify `website/app/sitemap.ts` — include Radar index, taxonomy and article URLs.
- Modify existing metadata/robots/llms surfaces only where needed to expose Radar accurately.

### Tests/docs

- Create `website/tests/unit/radar-articles.test.ts`.
- Create `website/tests/unit/radar-search.test.ts`.
- Create `website/tests/unit/radar-related.test.ts`.
- Create `website/tests/unit/radar-metadata.test.ts`.
- Create `website/tests/unit/radar-rss.test.ts`.
- Create `website/tests/components/radar-home.test.tsx`.
- Create `website/tests/components/radar-article.test.tsx`.
- Create `website/tests/e2e/radar.spec.ts`.
- Create `website/content/radar/README.md` — editorial authoring guide.
- Update `docs/runbooks/lumenva-website.md` with Radar verification and publishing notes.

---

### Task 1: Lock the Radar domain model and representative content

**Files:**
- Create: `website/lib/radar/types.ts`
- Create: `website/content/radar/articles.ts`
- Create: `website/content/radar/quick.ts`
- Test: `website/tests/unit/radar-articles.test.ts`

**Interfaces:**
- Produces `RadarArticle`, `RadarBlock`, `RadarQuickItem`, `RadarArticleType`, `RadarSource`.
- Produces exported `radarArticles` and `radarQuickItems` arrays.
- Later tasks consume these types directly; do not redefine them elsewhere.

- [ ] **Step 1: Write a failing domain-registry test**

Assert that representative articles have unique slugs, valid dates, positive reading time, at least one source, supported types only, non-empty titles/excerpts and safe `https:` source URLs.

Run:

```bash
cd website && pnpm vitest run tests/unit/radar-articles.test.ts
```

Expected: FAIL because Radar contracts/content do not exist.

- [ ] **Step 2: Implement the minimum typed contracts**

Use exactly these unions:

```ts
export type RadarArticleType = "noticia" | "insight" | "guia";
export type RadarBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title?: string; text: string }
  | { type: "image"; src: string; alt: string; caption?: string };
```

Add the full `RadarArticle` and `RadarQuickItem` contracts from the spec.

- [ ] **Step 3: Add representative, explicitly editorial seed content**

Create enough content to exercise all three types and category/listing behavior. Content must be either clearly evergreen/illustrative editorial copy or based on repository-confirmed facts; do not invent current news claims during implementation. Use neutral covers already present in the repository or omit cover images.

- [ ] **Step 4: Run the focused test and typecheck**

```bash
cd website && pnpm vitest run tests/unit/radar-articles.test.ts && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add website/lib/radar/types.ts website/content/radar website/tests/unit/radar-articles.test.ts
git commit -m "feat(radar): add typed editorial content model"
```

---

### Task 2: Build article registry, taxonomy and deterministic queries

**Files:**
- Create: `website/lib/radar/articles.ts`
- Modify: `website/tests/unit/radar-articles.test.ts`

**Interfaces:**

```ts
getAllRadarArticles(): RadarArticle[]
getRadarArticleBySlug(slug: string): RadarArticle | undefined
getFeaturedRadarArticle(): RadarArticle | undefined
getRadarArticlesByType(type: RadarArticleType): RadarArticle[]
getRadarArticlesByCategory(category: string): RadarArticle[]
getRadarCategories(): string[]
getRadarTags(): string[]
```

All list functions return newest-first ordering based on `publishedAt`, with slug as stable tie-breaker.

- [ ] **Step 1: Extend tests for sorting/filtering/not-found behavior**.
- [ ] **Step 2: Run focused test and confirm RED**.
- [ ] **Step 3: Implement registry helpers with no client/browser dependencies**.
- [ ] **Step 4: Run test and typecheck to GREEN**.
- [ ] **Step 5: Commit `feat(radar): add editorial registry queries`**.

---

### Task 3: Add local search and related-content ranking

**Files:**
- Create: `website/lib/radar/search.ts`
- Create: `website/lib/radar/related.ts`
- Test: `website/tests/unit/radar-search.test.ts`
- Test: `website/tests/unit/radar-related.test.ts`

**Interfaces:**

```ts
searchRadarArticles(query: string, articles?: RadarArticle[]): RadarArticle[]
getRelatedRadarArticles(article: RadarArticle, limit?: number): RadarArticle[]
```

Search normalization covers title, excerpt, category, type and tags, case-insensitively and accent-insensitively. Empty query returns the input in canonical newest-first order rather than throwing.

Related ranking uses deterministic scoring: shared category > shared tags > same type > recency; it must never return the current article or duplicates.

- [ ] **Step 1: Write RED tests for accents/case/empty search and related ranking**.
- [ ] **Step 2: Run both focused tests**.
- [ ] **Step 3: Implement normalization/ranking without third-party search dependencies**.
- [ ] **Step 4: Run focused tests + typecheck**.
- [ ] **Step 5: Commit `feat(radar): add local search and related content`**.

---

### Task 4: Integrate Radar into existing site navigation

**Files:**
- Modify: `website/components/layout/Header.tsx`
- Modify: `website/components/layout/MobileNavigation.tsx`
- Modify: `website/components/layout/Footer.tsx`
- Modify: `website/content/site.ts` if it owns canonical navigation data
- Test: existing layout/navigation tests plus a new focused assertion only if needed

**Interfaces:**
- Adds canonical `/radar` navigation entry.
- Must preserve all current site links and mobile menu accessibility.

- [ ] **Step 1: Inspect current navigation source-of-truth before editing; avoid duplicate hard-coded lists**.
- [ ] **Step 2: Add a failing test asserting Radar exists in desktop and mobile navigation**.
- [ ] **Step 3: Add Radar through the existing navigation data path**.
- [ ] **Step 4: Run affected component tests and lint**.
- [ ] **Step 5: Commit `feat(site): expose Lumenva Radar navigation`**.

---

### Task 5: Implement reusable Radar editorial components

**Files:**
- Create all `website/components/radar/*` presentation components listed in the file map except article-body/share/related components reserved for Task 8.
- Test: `website/tests/components/radar-home.test.tsx`

**Interfaces:**
- Components receive typed content via props; none imports mutable/global client state.
- Only `RadarSearch` and form-like interactive widgets may be client components.
- All colors come from existing semantic CSS tokens.

- [ ] **Step 1: Write a RED component test rendering representative home content and checking semantic headings/nav/article links**.
- [ ] **Step 2: Implement `RadarHero`, `FeaturedArticle`, `CategoryNav`, `ArticleCard`, `ArticleList`, `QuickRadar`, `TrendingTopics`**.
- [ ] **Step 3: Implement `RadarSearch` as a progressive enhancement using `searchRadarArticles`**.
- [ ] **Step 4: Verify mobile-oriented semantics: 44px targets, keyboard focus, no inaccessible clickable divs**.
- [ ] **Step 5: Run component test, typecheck and lint**.
- [ ] **Step 6: Commit `feat(radar): add editorial UI primitives`**.

---

### Task 6: Build `/radar` homepage

**Files:**
- Create: `website/app/radar/page.tsx`
- Create: `website/app/radar/page.module.css`
- Modify: `website/tests/components/radar-home.test.tsx`

**Interfaces:**
- Server component loads article/quick/tag registries and passes data down.
- Home sections: hero + featured article, categories, latest articles, quick radar, newsletter CTA placeholder/integration, trending tags.

- [ ] **Step 1: Add RED expectations for the Radar page composition**.
- [ ] **Step 2: Build the server-rendered homepage using existing site layout automatically inherited from root layout**.
- [ ] **Step 3: Match `website/DESIGN.md`: Manrope, neutral palette, editorial spacing, no invented metrics**.
- [ ] **Step 4: Add page metadata title/description/canonical through existing metadata utilities**.
- [ ] **Step 5: Run focused tests, typecheck, lint**.
- [ ] **Step 6: Commit `feat(radar): build Radar homepage`**.

---

### Task 7: Build section and category listing routes

**Files:**
- Create: `website/components/radar/RadarListingPage.tsx` + `.module.css`
- Create: `website/app/radar/noticias/page.tsx`
- Create: `website/app/radar/insights/page.tsx`
- Create: `website/app/radar/guias/page.tsx`
- Create: `website/app/radar/categoria/[slug]/page.tsx`
- Test: extend `website/tests/unit/radar-articles.test.ts`
- E2E later in Task 13

**Interfaces:**
- One shared listing component receives `{ title, description, articles }`.
- Dynamic category page uses `generateStaticParams()` from `getRadarCategories()`.
- Unknown category resolves via `notFound()`.

- [ ] **Step 1: Add tests for taxonomy slug normalization and unknown category**.
- [ ] **Step 2: Implement one listing primitive and the three static section routes**.
- [ ] **Step 3: Implement dynamic category route and static params**.
- [ ] **Step 4: Add route-specific metadata**.
- [ ] **Step 5: Run tests/typecheck/lint**.
- [ ] **Step 6: Commit `feat(radar): add editorial listings and taxonomy`**.

---

### Task 8: Build article rendering and related/share/source sections

**Files:**
- Create: `website/components/radar/ArticleBody.tsx` + `.module.css`
- Create: `website/components/radar/ArticleSources.tsx` + `.module.css`
- Create: `website/components/radar/ShareActions.tsx` + `.module.css`
- Create: `website/components/radar/RelatedArticles.tsx` + `.module.css`
- Create: `website/app/radar/[slug]/page.tsx` + `page.module.css`
- Test: `website/tests/components/radar-article.test.tsx`

**Interfaces:**
- `ArticleBody` exhaustively renders every `RadarBlock` variant.
- `[slug]` route uses `generateStaticParams()` and `notFound()`.
- External sources include `rel="noopener noreferrer"` when opening new tabs.
- Share actions use native URL construction only; no tracking SaaS.

- [ ] **Step 1: Write RED component tests for all block variants, sources and related links**.
- [ ] **Step 2: Implement the typed article body with exhaustive switch and semantic markup**.
- [ ] **Step 3: Implement sources, share actions and related content**.
- [ ] **Step 4: Build dynamic article route with dates/read time/tags/newsletter**.
- [ ] **Step 5: Run focused tests/typecheck/lint**.
- [ ] **Step 6: Commit `feat(radar): add article experience`**.

---

### Task 9: Add metadata, canonical URLs and structured data

**Files:**
- Create: `website/lib/radar/metadata.ts`
- Modify: `website/app/radar/[slug]/page.tsx`
- Modify: Radar listing pages as needed
- Test: `website/tests/unit/radar-metadata.test.ts`

**Interfaces:**

```ts
getRadarArticleUrl(article: RadarArticle): string
getRadarArticleMetadata(article: RadarArticle): Metadata
getRadarArticleJsonLd(article: RadarArticle): Record<string, unknown>
getRadarBreadcrumbJsonLd(article: RadarArticle): Record<string, unknown>
```

Use existing `getSiteUrl()`; do not hard-code production host.

- [ ] **Step 1: Write RED tests for canonical URL, fallback SEO copy and no fabricated fields**.
- [ ] **Step 2: Implement metadata/JSON-LD helpers**.
- [ ] **Step 3: Render JSON-LD safely in article route using serialization that escapes `<`**.
- [ ] **Step 4: Run focused tests/typecheck/build subset if possible**.
- [ ] **Step 5: Commit `feat(radar): add article SEO and structured data`**.

---

### Task 10: Add sitemap and RSS

**Files:**
- Modify: `website/app/sitemap.ts`
- Create: `website/lib/radar/rss.ts`
- Create: `website/app/radar/rss.xml/route.ts`
- Test: `website/tests/unit/radar-rss.test.ts`

**Interfaces:**
- Sitemap includes `/radar`, fixed section routes, category routes and all article URLs.
- RSS endpoint returns UTF-8 XML with `application/rss+xml` and only published canonical articles.

- [ ] **Step 1: Write RED RSS serialization tests, including XML escaping**.
- [ ] **Step 2: Implement RSS serializer with no new package**.
- [ ] **Step 3: Add route returning generated XML and cache semantics appropriate for file-backed content**.
- [ ] **Step 4: Extend existing sitemap from Radar registry**.
- [ ] **Step 5: Run focused tests/typecheck/lint**.
- [ ] **Step 6: Commit `feat(radar): publish sitemap and RSS surfaces`**.

---

### Task 11: Implement newsletter CTA using existing/free infrastructure only

**Files:**
- Create/finish: `website/components/radar/NewsletterCTA.tsx` + `.module.css`
- Inspect and reuse existing `website/app/api/*` contact/mail/rate-limit patterns.
- Create a Radar-specific API route only if existing infrastructure can support it honestly without a new paid dependency.
- Add focused tests matching whichever existing pattern is reused.

**Interfaces:**
- UI always works visually and accessibly.
- Email is validated before network submission.
- No fake subscriber count.
- If durable subscription storage is not already available for free in the repo/environment, do **not** invent one; render an honest availability state or route the signup through an already configured repository-backed mail path with documented behavior.

- [ ] **Step 1: Audit existing contact/Resend/rate-limit code and environment contract**.
- [ ] **Step 2: Write RED tests for invalid email, success and configured-unavailable behavior**.
- [ ] **Step 3: Implement the narrowest viable free integration**.
- [ ] **Step 4: Add abuse controls using only existing rate-limit facilities if the API route is networked**.
- [ ] **Step 5: Run focused tests/typecheck/lint**.
- [ ] **Step 6: Commit `feat(radar): add newsletter capture experience`**.

---

### Task 12: Add editorial analytics without a new paid service

**Files:**
- Reuse `website/components/layout/DeferredTelemetry.tsx` and existing analytics setup.
- Create a tiny Radar-specific telemetry helper/component only if needed.
- Modify Radar interactive components to emit meaningful events.
- Add unit/component tests where event names/payload shape have behavior.

**Event contract:**

```text
radar_article_view
radar_related_click
radar_share_click
radar_newsletter_submit
radar_source_click
```

Payloads may include article slug/type/category and campaign/source query params, but must not include raw email addresses or unnecessary personal data.

- [ ] **Step 1: Inspect existing analytics implementation and preserve its consent/loading behavior**.
- [ ] **Step 2: Add RED tests around event payload sanitization if a helper is introduced**.
- [ ] **Step 3: Wire the five events without adding an analytics vendor**.
- [ ] **Step 4: Run tests/typecheck/lint**.
- [ ] **Step 5: Commit `feat(radar): add editorial telemetry`**.

---

### Task 13: Add end-to-end coverage and accessibility/mobile regression checks

**Files:**
- Create: `website/tests/e2e/radar.spec.ts`
- Modify component/unit tests only for discovered regressions.

**Critical E2E scenarios:**

1. `/radar` loads and shows the Radar heading plus a featured/latest article.
2. Desktop navigation reaches `/radar`.
3. Mobile navigation reaches `/radar` at a 390px-class viewport.
4. An article opens and shows title, sources and related content.
5. Section route filters correctly.
6. Category route filters correctly.
7. Unknown article returns the site's 404 behavior.
8. Search filters locally and is keyboard operable.
9. RSS endpoint returns XML.
10. No page has horizontal overflow at 390px.

- [ ] **Step 1: Write E2E spec and run it RED against missing/incomplete behavior**.
- [ ] **Step 2: Fix only Radar-scoped regressions discovered by E2E**.
- [ ] **Step 3: Run `pnpm test:e2e -- tests/e2e/radar.spec.ts` or the repo-equivalent Playwright target**.
- [ ] **Step 4: Run component/unit Radar tests again**.
- [ ] **Step 5: Commit `test(radar): cover critical editorial journeys`**.

---

### Task 14: Add optional read-only Social integration seam

**Files:**
- Create only if the core Radar is green: `website/app/api/radar/articles/route.ts`
- Create tests under `website/tests/unit/` or API contract test location matching repository conventions.

**Interfaces:**

```ts
export type RadarPublicArticle = {
  slug: string;
  title: string;
  excerpt: string;
  url: string;
  coverUrl?: string;
  type: RadarArticleType;
  tags: string[];
  publishedAt: string;
};
```

The endpoint is GET/read-only. It exposes only public editorial metadata. It does not write to Social, send DMs, receive Instagram webhooks or expose secrets.

- [ ] **Step 1: Decide from existing API conventions whether a public read-only route is appropriate now**.
- [ ] **Step 2: If appropriate, write RED contract test then implement deterministic response from the content registry**.
- [ ] **Step 3: If inappropriate, document the exact interface above and skip route creation without blocking V1**.
- [ ] **Step 4: Commit either code or documentation decision**.

---

### Task 15: Write editorial/runbook documentation

**Files:**
- Create: `website/content/radar/README.md`
- Modify: `docs/runbooks/lumenva-website.md`
- Modify: `docs/index.md` if runbook/spec indexes require it

**Authoring guide must explain:**

- where articles live;
- exact required fields;
- allowed block types;
- slug rules;
- date format;
- how sources must be cited/linked;
- how to mark featured content;
- how categories/tags create navigation;
- how to preview locally;
- how to run Radar-specific tests;
- how to verify sitemap/RSS;
- what content must never be fabricated;
- that Social integration is separate.

- [ ] **Step 1: Write authoring guide using the final actual APIs/types rather than stale planned examples**.
- [ ] **Step 2: Update website runbook with Radar verification/publishing steps**.
- [ ] **Step 3: Run link/path sanity checks manually and lint docs if repo has a docs gate**.
- [ ] **Step 4: Commit `docs(radar): add publishing and operations guide`**.

---

### Task 16: Full verification and branch completion evidence

**Files:**
- Create: `docs/evidence/blog/radar-implementation-status.md`
- No production merge.

- [ ] **Step 1: Verify repository state before final gate**

```bash
git status --short
git branch --show-current
```

Expected branch: `blog`.

- [ ] **Step 2: Run all website unit/component tests**

```bash
cd website
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run static gates**

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

```bash
pnpm build
```

Expected: PASS and all Radar static/dynamic routes compile.

- [ ] **Step 5: Run E2E**

```bash
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 6: Perform a final grep/audit for prohibited implementation choices**

Confirm:

- no paid dependency was added;
- no subagent-generated work was used;
- no arbitrary chromatic brand colors were introduced;
- no fabricated metrics/testimonials/customer claims exist;
- no Social write/DM/webhook logic leaked into the website;
- `main` was not modified.

- [ ] **Step 7: Write evidence document**

Record exact commit SHA, commands, pass/fail counts, any external/environment-only limitation and whether the optional Social read-only seam was shipped or deferred.

- [ ] **Step 8: Commit evidence**

```bash
git add docs/evidence/blog/radar-implementation-status.md
git commit -m "docs(radar): record implementation verification"
```

- [ ] **Step 9: Stop on branch `blog`**

Do not merge to `main`. Report the branch HEAD and readiness to the user.

---

## Execution Order

```text
1 Domain model/content
  ↓
2 Registry/taxonomy
  ↓
3 Search/related
  ↓
4 Site navigation
  ↓
5 UI primitives
  ↓
6 Radar home
  ↓
7 Listings/categories
  ↓
8 Article page
  ↓
9 SEO/JSON-LD
  ↓
10 Sitemap/RSS
  ↓
11 Newsletter
  ↓
12 Analytics
  ↓
13 E2E/accessibility/mobile
  ↓
14 Optional Social read seam
  ↓
15 Documentation
  ↓
16 Full gate/evidence
```

## V1 Completion Contract

The implementation agent may declare **Lumenva Radar V1 complete** only when all of the following are true:

- [ ] `lumenva.pt/radar` implementation exists and is brand-correct.
- [ ] Notícias, Insights and Guias listings exist.
- [ ] Dynamic category pages exist.
- [ ] Dynamic article pages exist.
- [ ] Content is typed and file-backed.
- [ ] Radar Rápido exists.
- [ ] Local search works without SaaS.
- [ ] Related articles work deterministically.
- [ ] Sources are visible and safe.
- [ ] Share actions work.
- [ ] Newsletter UX is honest and uses only existing/free infrastructure.
- [ ] Existing analytics only; no new paid analytics dependency.
- [ ] Article metadata + canonical + JSON-LD exist.
- [ ] Sitemap includes Radar.
- [ ] RSS exists.
- [ ] Mobile 390px behavior is verified.
- [ ] Keyboard/focus semantics are verified.
- [ ] Unit/component/E2E tests pass.
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Production build passes.
- [ ] Editorial authoring documentation exists.
- [ ] Verification evidence exists.
- [ ] No subagents were used.
- [ ] No paid service is required.
- [ ] `lumenva-social` remains separate.
- [ ] `main` remains untouched.

## Explicitly Out of Scope for This Plan

These belong to the later Lumenva Social integration plan, not this Radar implementation:

- Instagram comment webhook processing;
- comment keyword matching;
- automatic Instagram public replies;
- automatic DMs;
- Social post creation/publishing;
- cross-repository write orchestration;
- AI news monitoring/automatic newsroom;
- autonomous research/fact-check agents;
- lead/CRM conversion pipeline.

The Radar must leave a clean metadata/API seam for those features without implementing them prematurely.
