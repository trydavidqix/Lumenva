# Lumenva Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and validate a mobile-first, independently deployable Lumenva institutional site that converts qualified visitors into demo requests routed safely to the existing CRM webhook.

**Architecture:** `/website` is a standalone Next.js 16 App Router project with its own dependencies, tests, and Vercel configuration. Marketing content lives in typed modules; reusable sections consume it; browser-only Three.js and GSAP modules are dynamically imported so semantic content and the demo form render without them. The public form posts to the website’s server route, which validates, rate-limits, and forwards the payload to the existing CRM webhook using server-only environment variables.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript 6 strict, CSS modules/global token CSS, Zod, GSAP + `@gsap/react`, Three.js + React Three Fiber, Vitest, Testing Library, Playwright, Manrope through `next/font/google`.

## Global Constraints

- All product code, dependencies, test configuration, and assets must be inside `/website`; do not modify CRM application code, Supabase, authentication, or existing deployment files.
- Use `pnpm@9.15.9` and Node `>=22`.
- Use the installed skills: `taste-design`, `manage-design-system`, `react-components`, `gsap-react`, `gsap-scrolltrigger`, `r3f-best-practices`, and the existing `vercel:react-best-practices` review.
- Use Manrope 800 for the Lumenva monogram and wordmark; do not use script or serif variants.
- Define the approved palette as semantic tokens; no component-local hex values.
- Start at 390 px, then add only the breakpoints needed for tablet, notebook, desktop, and large screens.
- Motion is progressive enhancement: respect `prefers-reduced-motion`, save-data, visibility, and lower-power fallbacks.
- Claims, FAQ answers, schemas, and content must stay within confirmed repository facts. Never invent metrics, testimonials, projects, customers, contact data, prices, or integrations.
- `LUMENVA_CRM_WEBHOOK_URL` and `LUMENVA_CRM_WEBHOOK_SECRET` are server-only. The latter is optional and signs the exact JSON string into `X-Deskcomm-Signature` with HMAC SHA-256 when present.
- The website must build as an independent Vercel project whose Root Directory is `website`.

---

## File Structure

```text
website/
├── app/
│   ├── api/demo/route.ts
│   ├── automacoes/page.tsx
│   ├── contato/page.tsx
│   ├── crm/page.tsx
│   ├── inteligencia-artificial/page.tsx
│   ├── integracoes/page.tsx
│   ├── projetos/page.tsx
│   ├── solucoes/page.tsx
│   ├── sobre/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── robots.ts
│   └── sitemap.ts
├── components/
│   ├── layout/{Header,Footer,MobileNavigation}.tsx
│   ├── motion/{Reveal,MagneticButton,ReducedMotionProvider}.tsx
│   ├── sections/{Hero,ProofBand,CapabilityNarrative,HowItWorks,FAQ,FinalCTA}.tsx
│   ├── three/{AIMarkScene,AIOrganism,scene-quality}.ts(x)
│   └── ui/{Button,DemoForm,JsonLd,SectionIntro}.tsx
├── content/{site,home,services,faq}.ts
├── hooks/{useMediaQuery,useReducedMotion,useInViewPause}.ts
├── lib/{env,metadata,schema,rate-limit,utils}.ts
├── styles/{tokens,layout,motion}.css
├── tests/{unit,components,e2e}/
├── DESIGN.md
├── .env.example
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── vitest.config.ts
```

### Task 1: Scaffold the isolated Next.js project and test harness

**Files:**
- Create: `website/package.json`
- Create: `website/tsconfig.json`
- Create: `website/next.config.ts`
- Create: `website/eslint.config.mjs`
- Create: `website/vitest.config.ts`
- Create: `website/tests/setup.ts`
- Create: `website/playwright.config.ts`
- Create: `website/.gitignore`
- Create: `website/.env.example`
- Create: `website/app/layout.tsx`
- Create: `website/app/page.tsx`
- Test: `website/tests/unit/smoke.test.ts`

**Interfaces:**
- Produces independent `dev`, `build`, `start`, `lint`, `typecheck`, `test`, and `test:e2e` scripts.
- Produces `@/*` aliases rooted at `/website`.

- [ ] **Step 1: Use `taste-design` to create `website/DESIGN.md` from the approved specification.**

Include the exact Lumenva palette, Manrope usage, broad whitespace, editorial hierarchy, no generic card grids, low-opacity radar behavior, mobile-first rules, and the prohibited content claims from the global constraints.

- [ ] **Step 2: Create the independent package manifest.**

```json
{
  "name": "lumenva-website",
  "private": true,
  "packageManager": "pnpm@9.15.9",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

Add exact dependencies: `next@^16.2.12`, `react@^19.2.8`, `react-dom@^19.2.8`, `gsap@^3.13.0`, `@gsap/react@^2.1.2`, `three@^0.181.0`, `@react-three/fiber@^9.4.2`, `@react-three/drei@^10.7.7`, `zod@^4.4.3`, and `lucide-react@^0.460.0`. Add exact development dependencies: `typescript@^6.0.3`, `@types/node@^20.16.0`, `@types/react@^19.2.17`, `@types/react-dom@^19.2.3`, `eslint@^9.12.0`, `eslint-config-next@^16.2.10`, `typescript-eslint@^8.65.0`, `vitest@^4.1.10`, `jsdom@^30.0.1`, `@testing-library/react@^16.3.2`, `@testing-library/jest-dom@^7.0.0`, `@testing-library/user-event@^14.6.1`, and `@playwright/test@^1.62.0`.

- [ ] **Step 3: Write the failing smoke test.**

```ts
import { expect, test } from "vitest";

test("website test harness is available", () => {
  expect(process.env.NODE_ENV).toBeDefined();
});
```

- [ ] **Step 4: Run the test before configuration is complete.**

Run: `pnpm --dir website test`

Expected: failure because the test runner/configuration has not yet been installed.

- [ ] **Step 5: Add strict TypeScript, Next, ESLint, Vitest, and Playwright configuration.**

Use `moduleResolution: "bundler"`, `strict: true`, `noUncheckedIndexedAccess: true`, and `paths: {"@/*": ["./*"]}`. Configure Vitest with `environment: "jsdom"` and `setupFiles: ["./tests/setup.ts"]`; configure Playwright to start `pnpm dev` on port 3100.

- [ ] **Step 6: Run installation and the harness checks.**

Run: `pnpm --dir website install && pnpm --dir website test && pnpm --dir website typecheck && pnpm --dir website lint`

Expected: all commands exit 0.

- [ ] **Step 7: Commit the isolated bootstrap.**

```bash
git add website
git commit -m "feat(website): scaffold independent Lumenva app"
```

### Task 2: Establish tokens, global styling, and the design-system contract

**Files:**
- Create: `website/styles/tokens.css`
- Create: `website/styles/layout.css`
- Create: `website/styles/motion.css`
- Create: `website/app/globals.css`
- Modify: `website/app/layout.tsx`
- Test: `website/tests/unit/tokens.test.ts`

**Interfaces:**
- Produces CSS custom properties consumed by all components.
- `RootLayout` imports `globals.css`, applies Manrope, and exposes semantic document metadata.

- [ ] **Step 1: Write the failing token-source test.**

```ts
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("tokens expose the approved semantic palette", () => {
  const css = readFileSync("styles/tokens.css", "utf8");
  expect(css).toContain("--color-accent: #0066CC");
  expect(css).toContain("--color-ink: #1D1D1F");
  expect(css).toContain("--color-surface: #F5F5F7");
});
```

- [ ] **Step 2: Run the test to confirm the token file is absent.**

Run: `pnpm --dir website test tests/unit/tokens.test.ts`

Expected: failure with an ENOENT error for `styles/tokens.css`.

- [ ] **Step 3: Use `manage-design-system` and create the token layers.**

Define color, type scale, spacing, radius, shadows, z-index, layout width, and easing tokens in `tokens.css`. Put container, breakpoint, section-spacing, grid, and safe-area rules in `layout.css`. Put only reusable keyframes and the `prefers-reduced-motion` reset in `motion.css`. Import all three from `globals.css`; no section stylesheet may redefine a palette hex.

- [ ] **Step 4: Configure Manrope once at the root.**

```tsx
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
```

Apply `${manrope.variable}` to `<html>` and use `var(--font-manrope)` through the typography tokens.

- [ ] **Step 5: Run the unit, type, and lint checks.**

Run: `pnpm --dir website test tests/unit/tokens.test.ts && pnpm --dir website typecheck && pnpm --dir website lint`

Expected: all commands exit 0.

- [ ] **Step 6: Commit the design system.**

```bash
git add website/DESIGN.md website/styles website/app/globals.css website/app/layout.tsx website/tests/unit/tokens.test.ts
git commit -m "feat(website): add Lumenva design tokens"
```

### Task 3: Create typed content, metadata, and structured-data utilities

**Files:**
- Create: `website/content/site.ts`
- Create: `website/content/home.ts`
- Create: `website/content/services.ts`
- Create: `website/content/faq.ts`
- Create: `website/lib/metadata.ts`
- Create: `website/lib/schema.ts`
- Create: `website/components/ui/JsonLd.tsx`
- Test: `website/tests/unit/schema.test.ts`

**Interfaces:**
- `site` exports `siteName`, `description`, `githubUrl`, and no invented organization contact data.
- `createPageMetadata(input: {title: string; description: string; path: string})` returns Next `Metadata` with canonical, Open Graph, and Twitter fields.
- `organizationSchema()`, `websiteSchema()`, `serviceSchema(service)`, `breadcrumbSchema(items)`, and `faqSchema(items)` return JSON-LD records containing only visible facts.

- [ ] **Step 1: Write failing schema tests.**

```ts
import { expect, test } from "vitest";
import { organizationSchema, faqSchema } from "@/lib/schema";

test("organization schema does not invent an address or telephone", () => {
  const schema = organizationSchema();
  expect(schema["@type"]).toBe("Organization");
  expect(schema).not.toHaveProperty("address");
  expect(schema).not.toHaveProperty("telephone");
});

test("FAQ schema mirrors visible questions", () => {
  const json = faqSchema([{ question: "O que é a Lumenva?", answer: "Resposta factual." }]);
  expect(json.mainEntity[0].name).toBe("O que é a Lumenva?");
});
```

- [ ] **Step 2: Run the test before the utility exists.**

Run: `pnpm --dir website test tests/unit/schema.test.ts`

Expected: failure because `@/lib/schema` cannot resolve.

- [ ] **Step 3: Implement the facts-first content model and utilities.**

Use the confirmed AI Sales OS, open-source, self-hosted, WhatsApp-native, human-governed, multi-niche, and MIT facts. Do not add customer names, result percentages, addresses, e-mail, phone, or social URLs. `createPageMetadata` must use `new URL(path, getSiteUrl())`, where `getSiteUrl` accepts `NEXT_PUBLIC_SITE_URL` or returns `http://localhost:3100` only for local development.

- [ ] **Step 4: Render a JSON-LD script safely.**

```tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
```

Only pass objects authored in local content modules; never interpolate raw user input into this component.

- [ ] **Step 5: Run the test and static checks.**

Run: `pnpm --dir website test tests/unit/schema.test.ts && pnpm --dir website typecheck && pnpm --dir website lint`

Expected: all commands exit 0.

- [ ] **Step 6: Commit content infrastructure.**

```bash
git add website/content website/lib website/components/ui/JsonLd.tsx website/tests/unit/schema.test.ts
git commit -m "feat(website): add factual content and schema utilities"
```

### Task 4: Build the approved Lumenva mark and progressive hero motion

**Files:**
- Create: `website/components/motion/ReducedMotionProvider.tsx`
- Create: `website/components/motion/Reveal.tsx`
- Create: `website/components/three/scene-quality.ts`
- Create: `website/components/three/AIOrganism.tsx`
- Create: `website/components/three/AIMarkScene.tsx`
- Create: `website/components/sections/Hero.tsx`
- Test: `website/tests/unit/scene-quality.test.ts`
- Test: `website/tests/components/hero.test.tsx`

**Interfaces:**
- `getSceneQuality(input: {width: number; deviceMemory?: number; reducedMotion: boolean; saveData: boolean})` returns `{enabled: boolean; dpr: [number, number]; particleCount: number}`.
- `Hero` renders readable heading, two CTAs, a static L-mark fallback, and lazily imports `AIMarkScene` only when quality is enabled.

- [ ] **Step 1: Read and apply `r3f-best-practices`, `gsap-react`, and `gsap-scrolltrigger` before writing the scene.**

Apply their rules: no React state in `useFrame`, memoized geometry/materials, bounded DPR, visibility pause, `useGSAP` scoped to a root ref, `ScrollTrigger` registration once in client code, and automatic `context.revert()` cleanup.

- [ ] **Step 2: Write failing quality and hero tests.**

```ts
import { expect, test } from "vitest";
import { getSceneQuality } from "@/components/three/scene-quality";

test("turns off canvas for reduced motion", () => {
  expect(getSceneQuality({ width: 390, reducedMotion: true, saveData: false })).toMatchObject({ enabled: false });
});

test("uses a constrained scene on small screens", () => {
  expect(getSceneQuality({ width: 390, reducedMotion: false, saveData: false })).toMatchObject({ enabled: true, particleCount: 36 });
});
```

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Hero } from "@/components/sections/Hero";

test("renders the demo CTA without a canvas", () => {
  render(<Hero />);
  expect(screen.getByRole("link", { name: /solicitar demonstração/i })).toBeVisible();
});
```

- [ ] **Step 3: Run the tests to confirm they fail.**

Run: `pnpm --dir website test tests/unit/scene-quality.test.ts tests/components/hero.test.tsx`

Expected: failures because the scene utility and Hero component are missing.

- [ ] **Step 4: Implement the static mark and the dynamic scene.**

The fallback mark is a centered Manrope 800 `L` over CSS scan rings and three points. The canvas version renders low-count nodes and line segments with organic sinusoidal offsets, not heavy post-processing. `AIMarkScene` must call `useInViewPause` and set `frameloop="never"` when paused; it must use DPR from `getSceneQuality` and must not allocate objects inside the frame loop.

- [ ] **Step 5: Implement the approved timing.**

Use `useGSAP` to settle the L first. At 90% of that reveal timeline, fade in the scan layer behind it, rotate it slowly, and reveal the points. Under reduced motion, render every final visual state statically. The CTA must never wait for either timeline.

- [ ] **Step 6: Run tests and check the initial bundle.**

Run: `pnpm --dir website test tests/unit/scene-quality.test.ts tests/components/hero.test.tsx && pnpm --dir website typecheck && pnpm --dir website lint`

Expected: all commands exit 0.

- [ ] **Step 7: Commit hero motion.**

```bash
git add website/components/motion website/components/three website/components/sections/Hero.tsx website/tests
git commit -m "feat(website): add adaptive Lumenva hero motion"
```

### Task 5: Build reusable layout, navigation, and core UI primitives

**Files:**
- Create: `website/components/layout/Header.tsx`
- Create: `website/components/layout/MobileNavigation.tsx`
- Create: `website/components/layout/Footer.tsx`
- Create: `website/components/ui/Button.tsx`
- Create: `website/components/ui/SectionIntro.tsx`
- Create: `website/components/motion/MagneticButton.tsx`
- Create: `website/hooks/useMediaQuery.ts`
- Test: `website/tests/components/header.test.tsx`
- Test: `website/tests/components/button.test.tsx`

**Interfaces:**
- `Button` accepts `href`, `variant`, `children`, and optional `magnetic`.
- `Header` accepts no data props and reads typed navigation from `content/site.ts`.
- `MobileNavigation` owns dialog state and exposes all route links and the demo CTA to keyboard users.

- [ ] **Step 1: Write failing navigation and CTA tests.**

```tsx
test("mobile navigation exposes every public route", async () => {
  const user = userEvent.setup();
  render(<Header />);
  await user.click(screen.getByRole("button", { name: /abrir menu/i }));
  expect(screen.getByRole("link", { name: /inteligência artificial/i })).toBeVisible();
  expect(screen.getByRole("link", { name: /solicitar demonstração/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the component tests to confirm they fail.**

Run: `pnpm --dir website test tests/components/header.test.tsx tests/components/button.test.tsx`

Expected: failure because `Header` and `Button` do not yet exist.

- [ ] **Step 3: Implement accessible primitives using `react-components`.**

Use visible `:focus-visible` styles, 44 px minimum button height, semantic `<a>` for navigation, semantic `<button>` for actions, and an accessible dialog menu. `MagneticButton` must return unmodified children for coarse pointers, reduced motion, and keyboard focus.

- [ ] **Step 4: Add the header/footer around `children` in the root layout.**

Use a sticky header that preserves contrast over light sections. The footer supplies only known public destinations and the GitHub repository link.

- [ ] **Step 5: Run component and static checks.**

Run: `pnpm --dir website test tests/components/header.test.tsx tests/components/button.test.tsx && pnpm --dir website typecheck && pnpm --dir website lint`

Expected: all commands exit 0.

- [ ] **Step 6: Commit reusable UI.**

```bash
git add website/components/layout website/components/ui website/components/motion/MagneticButton.tsx website/hooks/useMediaQuery.ts website/app/layout.tsx website/tests/components
git commit -m "feat(website): add marketing layout and navigation"
```

### Task 6: Assemble the exceptional mobile-first Home page

**Files:**
- Create: `website/components/sections/ProofBand.tsx`
- Create: `website/components/sections/CapabilityNarrative.tsx`
- Create: `website/components/sections/HowItWorks.tsx`
- Create: `website/components/sections/IntegrationStrip.tsx`
- Create: `website/components/sections/FAQ.tsx`
- Create: `website/components/sections/FinalCTA.tsx`
- Modify: `website/app/page.tsx`
- Test: `website/tests/components/home.test.tsx`
- Test: `website/tests/e2e/home.spec.ts`

**Interfaces:**
- Every section consumes a typed content array, not inline duplicated copy.
- `FAQ` consumes `FaqItem[]` and renders native accessible disclosure controls.

- [ ] **Step 1: Write the failing Home composition test.**

```tsx
test("home has one h1 and the approved conversion path", () => {
  render(<HomePage />);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getAllByRole("link", { name: /solicitar demonstração/i }).length).toBeGreaterThan(1);
  expect(screen.getByRole("heading", { name: /agentes de ia/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the test before page composition.**

Run: `pnpm --dir website test tests/components/home.test.tsx`

Expected: failure because Home does not render the required sections.

- [ ] **Step 3: Build each editorial section with only factual content.**

Use the approved sequence from the design: hero, proof band, capabilities, agent narrative, automations, CRM, how it works, integrations, FAQ, and final CTA. Do not render the unpublished projects/results/testimonials section; retain its content data type but an empty array must produce no markup.

- [ ] **Step 4: Add scroll motion only after semantic content works.**

Use `Reveal` with `useGSAP` and `ScrollTrigger`. Pin only the desktop version of the five-step agent narrative. Mobile uses ordinary in-flow sections with reveal disabled under reduced motion.

- [ ] **Step 5: Write the Playwright mobile journey.**

```ts
test("390 px home keeps demo CTA and navigation usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /abrir menu/i }).click();
  await expect(page.getByRole("link", { name: /solicitar demonstração/i })).toBeVisible();
});
```

- [ ] **Step 6: Run Home tests and visual checks.**

Run: `pnpm --dir website test tests/components/home.test.tsx && pnpm --dir website test:e2e tests/e2e/home.spec.ts && pnpm --dir website typecheck && pnpm --dir website lint`

Expected: all commands exit 0 and the 390 px screenshot has no horizontal overflow.

- [ ] **Step 7: Commit the Home page.**

```bash
git add website/components/sections website/app/page.tsx website/tests/components/home.test.tsx website/tests/e2e/home.spec.ts
git commit -m "feat(website): build mobile-first Lumenva home"
```

### Task 7: Implement the service, about, projects, and contact routes

**Files:**
- Create: `website/components/sections/ServiceHero.tsx`
- Create: `website/components/sections/Breadcrumbs.tsx`
- Create: `website/components/sections/ProseFAQ.tsx`
- Create: `website/app/{solucoes,inteligencia-artificial,automacoes,crm,integracoes,projetos,sobre,contato}/page.tsx`
- Test: `website/tests/e2e/routes.spec.ts`

**Interfaces:**
- Each route calls `createPageMetadata` and renders a route-specific `BreadcrumbList` schema.
- Service routes use `ServiceHero` with `{eyebrow, title, description, capabilities}` data.

- [ ] **Step 1: Write the failing route coverage test.**

```ts
for (const path of ["/solucoes", "/inteligencia-artificial", "/automacoes", "/crm", "/integracoes", "/projetos", "/sobre", "/contato"]) {
  test(`${path} has a visible h1 and demo CTA`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /solicitar demonstração/i })).toBeVisible();
  });
}
```

- [ ] **Step 2: Run the route test before pages exist.**

Run: `pnpm --dir website test:e2e tests/e2e/routes.spec.ts`

Expected: failure with route 404 responses.

- [ ] **Step 3: Implement the route templates and content.**

Every route gets semantic headings, breadcrumb navigation, factual copy, a conversion CTA, route-specific metadata, and JSON-LD. `/projetos` clearly states that approved case studies will be published there; it contains no invented placeholders that imitate cases.

- [ ] **Step 4: Run the route test and static checks.**

Run: `pnpm --dir website test:e2e tests/e2e/routes.spec.ts && pnpm --dir website typecheck && pnpm --dir website lint`

Expected: all commands exit 0.

- [ ] **Step 5: Commit public routes.**

```bash
git add website/app website/components/sections website/tests/e2e/routes.spec.ts
git commit -m "feat(website): add Lumenva service pages"
```

### Task 8: Implement secure demo capture and its failure states

**Files:**
- Create: `website/lib/env.ts`
- Create: `website/lib/rate-limit.ts`
- Create: `website/components/ui/DemoForm.tsx`
- Create: `website/app/api/demo/route.ts`
- Modify: `website/app/contato/page.tsx`
- Modify: `website/components/sections/FinalCTA.tsx`
- Test: `website/tests/unit/demo-route.test.ts`
- Test: `website/tests/components/demo-form.test.tsx`

**Interfaces:**
- `DemoRequestSchema` accepts `{name, company, email, whatsapp, consent, website}` where `website` is the honeypot.
- `POST /api/demo` returns `{ok: true}` on a forwarded 2xx response and `{ok: false, error: "invalid" | "rate_limited" | "unavailable"}` otherwise.
- `signWebhookBody(body: string, secret: string): string` produces the CRM’s `X-Deskcomm-Signature` header.

- [ ] **Step 1: Write failing server-route tests.**

```ts
test("forwards normalized demo requests with the CRM signature", async () => {
  const validDemo = {
    name: "Ana Silva",
    company: "Lumen Comércio",
    email: "ana@example.com",
    whatsapp: "+5511999999999",
    consent: true,
    website: "",
  };
  process.env.LUMENVA_CRM_WEBHOOK_URL = "https://crm.example/api/v1/webhooks/in/token";
  process.env.LUMENVA_CRM_WEBHOOK_SECRET = "secret";
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { lead_id: "lead-1" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await POST(new Request("http://localhost/api/demo", { method: "POST", body: JSON.stringify(validDemo) }));

  expect(response.status).toBe(200);
  expect(fetchMock.mock.calls[0]?.[1]?.headers).toHaveProperty("X-Deskcomm-Signature");
});
```

- [ ] **Step 2: Run the server test before the route exists.**

Run: `pnpm --dir website test tests/unit/demo-route.test.ts`

Expected: failure because the API route cannot resolve.

- [ ] **Step 3: Implement validation, honeypot, rate limiting, and forwarding.**

Reject a non-empty `website` field with a generic success response and no forward. Require checked consent. Normalize whitespace, use the original body string for HMAC, set `Content-Type: application/json`, set `X-Deskcomm-Signature` only when the optional secret exists, and use an 8-second `AbortSignal.timeout(8000)`. Log only a short failure reason, never form data.

- [ ] **Step 4: Implement the accessible form states.**

The form must show field-specific validation messages via `aria-describedby`, a pending button state, a success state, and a retryable unavailable state. It must never expose the CRM URL or signature to the browser.

- [ ] **Step 5: Run route and component tests.**

Run: `pnpm --dir website test tests/unit/demo-route.test.ts tests/components/demo-form.test.tsx && pnpm --dir website typecheck && pnpm --dir website lint`

Expected: all commands exit 0.

- [ ] **Step 6: Commit demo capture.**

```bash
git add website/app/api/demo website/components/ui/DemoForm.tsx website/lib website/tests
git commit -m "feat(website): route demo requests to CRM webhook"
```

### Task 9: Complete SEO entry points and Vercel readiness

**Files:**
- Create: `website/app/robots.ts`
- Create: `website/app/sitemap.ts`
- Create: `website/vercel.json`
- Create: `website/README.md`
- Modify: `website/.env.example`
- Test: `website/tests/unit/seo.test.ts`

**Interfaces:**
- `robots()` references `/sitemap.xml` at `NEXT_PUBLIC_SITE_URL`.
- `sitemap()` returns every public route using the same base URL helper as metadata.
- README lists local commands, required env variables, Vercel Root Directory, and the CRM webhook source setup.

- [ ] **Step 1: Write failing SEO tests.**

```ts
test("sitemap includes every public marketing route", async () => {
  const entries = await sitemap();
  expect(entries.map((entry) => entry.url)).toContain("http://localhost:3100/contato");
  expect(entries.map((entry) => entry.url)).toContain("http://localhost:3100/inteligencia-artificial");
});
```

- [ ] **Step 2: Run the SEO test before entry points exist.**

Run: `pnpm --dir website test tests/unit/seo.test.ts`

Expected: failure because `app/sitemap.ts` does not exist.

- [ ] **Step 3: Implement sitemap, robots, and Vercel documentation.**

Set `framework: "nextjs"` in `vercel.json`; do not include a deployment target or CRM credential. In `.env.example`, document `NEXT_PUBLIC_SITE_URL`, `LUMENVA_CRM_WEBHOOK_URL`, and `LUMENVA_CRM_WEBHOOK_SECRET` with empty values. Explain that the URL/secret come from an active CRM Webhooks source and must be configured in Vercel before publishing.

- [ ] **Step 4: Run SEO tests and the production build.**

Run: `pnpm --dir website test tests/unit/seo.test.ts && pnpm --dir website build`

Expected: both commands exit 0.

- [ ] **Step 5: Commit deployment readiness.**

```bash
git add website/app/robots.ts website/app/sitemap.ts website/vercel.json website/.env.example website/README.md website/tests/unit/seo.test.ts
git commit -m "feat(website): add SEO and Vercel readiness"
```

### Task 10: Verify responsive behavior, motion preference, and production quality

**Files:**
- Create: `website/tests/e2e/responsive.spec.ts`
- Create: `website/tests/e2e/reduced-motion.spec.ts`
- Create: `website/tests/e2e/demo-form.spec.ts`
- Modify: `website/playwright.config.ts`
- Modify: `website/README.md`

**Interfaces:**
- Playwright project uses 390×844 mobile and 1440×1000 desktop checks.
- Reduced-motion test uses `page.emulateMedia({ reducedMotion: "reduce" })`.

- [ ] **Step 1: Write the failing responsive and motion checks.**

```ts
test("mobile page has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("reduced motion disables the canvas and scan loop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("hero-static-mark")).toBeVisible();
  await expect(page.getByTestId("hero-canvas")).toHaveCount(0);
});
```

- [ ] **Step 2: Run the tests before final refinements.**

Run: `pnpm --dir website test:e2e tests/e2e/responsive.spec.ts tests/e2e/reduced-motion.spec.ts tests/e2e/demo-form.spec.ts`

Expected: any existing discrepancy is captured as a failing test before its CSS or component fix.

- [ ] **Step 3: Correct every failure at its component boundary.**

Fix overflow in the responsible layout/component token, use `aria-live="polite"` for form success/error feedback, and ensure the reduced-motion branch renders the static mark without importing R3F.

- [ ] **Step 4: Review changed TSX with `vercel:react-best-practices`.**

Apply the review’s relevant findings before final verification: avoid client components unless interaction requires them, avoid unnecessary effects, preserve server-rendered content, and keep dynamic imports at feature boundaries.

- [ ] **Step 5: Run the complete verification suite.**

Run: `pnpm --dir website lint && pnpm --dir website typecheck && pnpm --dir website test && pnpm --dir website build && pnpm --dir website test:e2e`

Expected: all commands exit 0. Capture mobile and desktop Playwright screenshots as evidence.

- [ ] **Step 6: Commit the verified website.**

```bash
git add website
git commit -m "feat(website): verify responsive Lumenva release"
```

### Task 11: Configure and publish the independent Vercel project when credentials are available

**Files:**
- Modify: `website/README.md`

**Interfaces:**
- Vercel project Root Directory is `website`.
- Production environment contains `NEXT_PUBLIC_SITE_URL`, `LUMENVA_CRM_WEBHOOK_URL`, and, when the CRM source uses a secret, `LUMENVA_CRM_WEBHOOK_SECRET`.

- [ ] **Step 1: Verify Vercel access without changing an existing project.**

Run: `pnpm dlx vercel whoami`

Expected: the authenticated account is shown; otherwise record that deployment is blocked by unavailable credentials.

- [ ] **Step 2: Link or create only the independent website project.**

Run: `pnpm dlx vercel link --cwd website`

Expected: the linked project has Root Directory `website`; do not link the existing CRM project.

- [ ] **Step 3: Set only the documented environment variables after values are supplied.**

Run: `pnpm dlx vercel env add NEXT_PUBLIC_SITE_URL production --cwd website`

Expected: Vercel prompts for the confirmed public Lumenva URL. Repeat for the CRM webhook URL and optional HMAC secret. Never print values to terminal output or commit them.

- [ ] **Step 4: Deploy and verify public routes.**

Run: `pnpm dlx vercel --prod --cwd website`

Expected: a production URL. Visit `/`, `/contato`, `/sitemap.xml`, and `/robots.txt`; submit a test demo only if the user authorizes a real lead to be created in the CRM.

- [ ] **Step 5: Record the deployment URL in README only if it is public and approved.**

```bash
git add website/README.md
git commit -m "docs(website): record Lumenva deployment"
```

## Plan Self-Review

### Spec coverage

- Isolated `/website` project: Task 1.
- Design system, approved mark, and mobile-first hierarchy: Tasks 2, 4, 5, and 6.
- Every requested route: Task 7.
- Demo conversion and CRM forwarding: Task 8.
- GSAP, ScrollTrigger, R3F, performance, and reduced motion: Tasks 4, 6, and 10.
- SEO, GEO, AEO, sitemap, robots, and JSON-LD: Tasks 3, 7, and 9.
- Lint, typecheck, build, responsiveness, and Vercel: Tasks 10 and 11.
- No fabricated social proof: Tasks 3, 6, and 7 explicitly omit it until factual content is supplied.

### Placeholder scan

The plan contains no unresolved content placeholders, generic “appropriate error handling” instruction, or unnamed interfaces. Deployment values remain intentionally external configuration and are never represented as fabricated data.

### Type consistency

- `getSceneQuality` is created in Task 4 and consumed only by Task 4’s `Hero`.
- Schema helpers are created in Task 3 and consumed by Task 7 and Task 9.
- `DemoRequestSchema`, `signWebhookBody`, and `POST /api/demo` are created in Task 8 and exercised by Task 10.
- `createPageMetadata` is created in Task 3 and consumed by Task 7.
