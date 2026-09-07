# Lumenva Radar — Design Specification

**Date:** 2026-09-07  
**Status:** Approved direction for implementation planning  
**Branch:** `blog`

## 1. Objective

Add a complete editorial hub called **Lumenva Radar** to the existing institutional website at `lumenva.pt/radar`, without creating a separate website or repository.

The Radar is the canonical owned-content destination for company news, AI/technology coverage, insights and practical guides. It must be useful independently from social networks while remaining ready for a later integration with `lumenva-social` for post → comment keyword → DM → article workflows.

## 2. Non-negotiable execution constraints

- Work only on branch `blog` until the user explicitly authorizes another branch or merge.
- Do not modify or merge `main` as part of this plan.
- Implementation is **inline only**. Do not dispatch subagents.
- The implementing agent has autonomy to create, edit, remove, refactor, test and document files required by this Radar scope inside branch `blog` without asking for per-file approval.
- Do not purchase, subscribe to, or require paid services.
- Prefer existing dependencies and free/local capabilities already present in `website/`.
- Do not introduce a paid CMS, paid search provider, paid analytics dependency, paid image service, or paid newsletter platform.
- Do not make `lumenva-social` a runtime dependency of Radar V1.
- Do not invent company metrics, testimonials, customers, legal claims, social proof or unsupported product claims.

## 3. Existing site contract

The Radar inherits `website/DESIGN.md` as its visual source of truth.

Required brand rules:

- Lumenva Black `#111111`.
- Lumenva Gray `#6E6E73`.
- Lumenva White `#F5F5F7` plus approved neutral derivations only.
- Manrope for brand, display, body and interface.
- Technical labels may use system monospace sparingly.
- No chromatic accent, neon, purple/blue AI aesthetic, gradient headline text or arbitrary component hex values.
- Semantic tokens from `website/styles/tokens.css` remain the palette source of truth.
- Mobile-first from 390 px, single column below 768 px, no horizontal overflow.
- Existing site header/footer/navigation patterns must be reused instead of forking a second design system.

## 4. Product architecture

The Radar lives inside the existing Next.js website:

```text
lumenva.pt
└── /radar
    ├── /noticias
    ├── /insights
    ├── /guias
    ├── /categoria/[slug]
    └── /[slug]
```

The website owns:

- article rendering;
- editorial taxonomy;
- canonical URLs;
- metadata/SEO;
- sitemap and RSS;
- newsletter capture UI and local/free backend path;
- editorial analytics events;
- source attribution;
- article sharing links.

`lumenva-social` remains a separate project. A later integration may consume Radar article metadata/URLs through a narrow API contract, but that is not required to ship Radar V1.

## 5. Content model

Radar content is file-backed for V1 to avoid CMS cost and infrastructure.

Canonical content lives under:

```text
website/content/radar/
```

Each article exposes a typed record with at least:

```ts
type RadarArticle = {
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  type: "noticia" | "insight" | "guia";
  category: string;
  tags: string[];
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  featured: boolean;
  cover?: {
    src: string;
    alt: string;
  };
  seo?: {
    title?: string;
    description?: string;
  };
  sources: Array<{
    label: string;
    url: string;
  }>;
  body: RadarBlock[];
};
```

`RadarBlock` uses a deliberately small structured-content vocabulary for V1 rather than a new MDX dependency:

- paragraph;
- heading;
- bullets;
- quote;
- callout;
- image.

This keeps content executable with the current stack and avoids adding a parser/CMS unless later justified.

## 6. Radar home

`/radar` contains:

1. Existing Lumenva header with Radar active.
2. Editorial hero with Lumenva Radar title/value proposition.
3. One featured article selected from content data.
4. Category navigation: Todos, Notícias, Insights, Guias plus topic/category links when populated.
5. Latest publications.
6. Radar Rápido — a compact chronological feed for short updates.
7. Newsletter CTA.
8. Trending topics derived from article tags/content, never fake metrics.
9. Existing Lumenva footer.

No fabricated readership counters or fake popularity numbers are allowed.

## 7. Article page

Each `/radar/[slug]` page contains:

- breadcrumb/category context;
- publication/update date;
- reading time;
- title/subtitle;
- optional cover;
- quick summary when provided;
- structured article body;
- visible sources section;
- tags;
- native share links/actions;
- related articles based on type/category/tags;
- newsletter CTA;
- canonical metadata and Article JSON-LD.

External sources open safely and visibly identify the source label/domain.

## 8. Listing and taxonomy pages

Static section routes:

- `/radar/noticias`
- `/radar/insights`
- `/radar/guias`

Dynamic taxonomy route:

- `/radar/categoria/[slug]`

These routes reuse one listing primitive and typed filters rather than duplicating page logic.

Empty categories render a useful empty state and never return a broken grid.

## 9. Radar Rápido

Radar Rápido is a separate typed dataset under `website/content/radar/quick.ts`.

Each item contains:

- id;
- timestamp/date;
- headline;
- optional article slug;
- optional source URL/label.

It renders chronologically on `/radar`; linked items navigate to the related article when available.

## 10. SEO and machine-readable surfaces

Radar must provide:

- per-page metadata;
- canonical URLs;
- Open Graph/Twitter metadata;
- Article JSON-LD for article pages;
- BreadcrumbList JSON-LD where appropriate;
- Radar URLs in the existing sitemap;
- `/radar/rss.xml` RSS feed;
- correct robots/indexability behavior;
- no fabricated structured-data claims.

## 11. Search

Search is local and free.

V1 search uses the loaded article index and normalizes title, excerpt, tags, category and type. No external search SaaS is introduced.

A search UI may live on `/radar` and/or `/radar/busca`, provided it is keyboard-accessible and useful on mobile.

## 12. Newsletter

The newsletter form reuses the website's existing mail/server patterns where safe and available.

V1 requirements:

- email validation;
- consent text appropriate to the actual behavior;
- source recorded as `radar` when persistence exists;
- rate limiting using existing project facilities when network submission is used;
- no fake subscriber counts;
- success/error states;
- no paid newsletter service requirement.

If no durable free subscriber store is already available in the website runtime, V1 must fail honestly or use an existing repository-backed integration rather than inventing paid infrastructure. The Radar itself must remain shippable without newsletter persistence blocking the entire release.

## 13. Analytics

Use the analytics capability already present in the website rather than adding a paid product.

Track only meaningful editorial events such as:

- radar article view;
- related-article click;
- share click;
- newsletter submit result;
- outbound source click.

UTM parameters from social traffic must survive navigation naturally and may be read for reporting without storing sensitive user data unnecessarily.

## 14. Integration seam for Lumenva Social

Radar V1 must expose a stable internal content contract so a later Social integration can fetch or receive:

```ts
type RadarPublicArticle = {
  slug: string;
  title: string;
  excerpt: string;
  url: string;
  coverUrl?: string;
  type: "noticia" | "insight" | "guia";
  tags: string[];
  publishedAt: string;
};
```

A future endpoint such as `/api/radar/articles` may publish this read-only metadata. V1 may include this endpoint if it is secured/rate-limited appropriately and does not delay the core site.

The future Social flow is:

```text
Radar article
→ Social post
→ CTA keyword
→ Instagram comment webhook
→ Lumenva Social automation
→ DM
→ canonical lumenva.pt/radar/<slug> URL
```

No Social webhook/DM automation is implemented in this Radar plan.

## 15. Accessibility and performance

- Keyboard-accessible navigation and controls.
- Visible focus states.
- 44 px minimum interactive targets.
- Proper heading hierarchy.
- Semantic `article`, `nav`, `section`, `time` and list markup.
- Reduced-motion support.
- Images use Next.js optimization where appropriate and explicit dimensions/aspect ratios to avoid layout shift.
- Radar should remain server-rendered/static where possible; client components only where interaction requires them.

## 16. Testing and release gates

Radar implementation is not complete until all applicable gates pass from `website/`:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Add focused Vitest tests for content parsing/filtering/related/search/SEO helpers and Playwright coverage for critical Radar navigation and article rendering.

No merge to `main` is part of the implementation plan. Completion means the `blog` branch is internally green and ready for user review.

## 17. Definition of Done

Radar V1 is complete when:

- `/radar` is production-quality and brand-correct;
- all article/listing/category routes work on desktop and mobile;
- content is typed and file-backed without paid CMS dependency;
- at least representative seed/demo editorial entries render without invented company claims;
- sources are visible and safe;
- search works locally;
- SEO metadata, JSON-LD, sitemap and RSS are valid;
- newsletter UI has honest success/failure behavior and does not block Radar if persistence is unavailable;
- analytics uses existing site capabilities only;
- accessibility/performance regressions are addressed;
- unit, typecheck, lint, build and E2E gates pass;
- documentation explains how to add/edit/publish a Radar article;
- no subagent was required;
- no paid dependency was added;
- `main` remains untouched.
