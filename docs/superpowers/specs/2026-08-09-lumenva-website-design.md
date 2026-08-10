# Lumenva Website — Design Specification

**Date:** 2026-08-09  
**Status:** Approved visual direction; awaiting written-spec review  
**Branch:** `feat/lumenva-website`

## 1. Purpose and boundaries

Build a standalone institutional website for **Lumenva**, the new public brand for the existing DeskcommCRM product. Lumenva keeps the confirmed product positioning: an open-source, self-hosted AI Sales OS where AI agents operate sales and support through WhatsApp.

The website is an independent Next.js project rooted at `/website`. It must not change the existing CRM app, Supabase schema, authentication, deployment, or CRM source code. The only connection to the CRM is an outbound server-to-server lead-capture request to the existing public webhook receiver.

The primary conversion is **requesting a demonstration**. The form collects name, company, email, and WhatsApp number.

## 2. Brand direction

### Brand signature

- **Name:** Lumenva.
- **Monogram:** a clean `L` set in Manrope 800, centered in the hero mark.
- **Wordmark:** `Lumenva` in Manrope 800.
- **Motion:** the monogram settles into place first. In the final 10% of its reveal, a low-opacity circular scan appears behind it, completes a slow sweep, and reveals three small “found” points. The mark remains the protagonist; the radar is supporting motion.
- **Reduced motion:** the final `L`, scan rings, and points render statically with no loop.

### Typography

| Role | Family | Treatment |
|---|---|---|
| Brand and display | Manrope | 700–800, tight tracking, optical clarity |
| Body and interface | Manrope | 500–700, comfortable line height |
| Code/data labels | system mono | sparingly for agent/radar labels only |

### Design tokens

```css
--color-accent: #0066CC;
--color-accent-hover: #0071E3;
--color-accent-on-dark: #2997FF;
--color-ink: #1D1D1F;
--color-white: #FFFFFF;
--color-surface: #F5F5F7;
--color-surface-subtle: #FAFAFC;
--color-black: #000000;
```

No component may own arbitrary hex colors. Derived alpha layers and shadows are defined as semantic tokens in `/website/styles/tokens.css`.

## 3. Information architecture

| Route | Intent |
|---|---|
| `/` | Demonstrate Lumenva’s AI Sales OS value and drive demo requests. |
| `/solucoes` | Overview of AI agents, automations, CRM, WhatsApp, and self-hosting. |
| `/inteligencia-artificial` | Explain native AI agents, RAG, governed handoffs, and human control. |
| `/automacoes` | Explain event-driven sales automation and the supported operating model. |
| `/crm` | Explain inbox, pipeline, customer context, and multi-tenant CRM foundation. |
| `/integracoes` | Present WhatsApp and documented integrations without claiming unsupported ones. |
| `/projetos` | Reserved case-study index; only verifiable cases are published. |
| `/sobre` | Explain the Lumenva mission, open-source model, and product principles. |
| `/contato` | Demo-request form and concise contact FAQ. |

The header supplies these pages through desktop navigation and a focused mobile drawer. Every route provides a visible “Solicitar demonstração” CTA.

## 4. Home-page composition

1. **Header** — signature, navigation, mobile menu, demo CTA.
2. **Hero** — large Lumenva monogram with scan-motion experience, one concise positioning statement, primary demo CTA and GitHub secondary link.
3. **Proof band** — factual product properties: open source, self-hosted, WhatsApp-native, human-governed agents. No invented numerical metrics.
4. **What Lumenva does** — a short editorial sequence that frames the system as AI agents, automation, and CRM operating together.
5. **AI agents** — “understand → decide → execute → automate → result” storytelling with constrained motion.
6. **Automations** — event-to-action model and human control.
7. **CRM** — context, pipeline, inbox, and governance capabilities.
8. **How it works** — a connected, scroll-led explanation rather than a grid of generic cards.
9. **Integrations** — confirmed channels and integrations only.
10. **Projects/results/testimonials** — a data-driven section rendered only when approved, verifiable content is supplied. The initial release must not invent customer logos, quotes, results, or cases.
11. **FAQ** — factual questions drawn from the documented project model.
12. **Final CTA** — demo form entry point.
13. **Footer** — route navigation, open-source link, legal placeholders only when supplied.

## 5. Interaction and motion system

### Hero mark

- Client-only dynamic import; never blocks initial content.
- Full motion on capable desktop devices.
- Simplified CSS/SVG fallback on mobile and lower-power devices.
- Adaptive DPR, bounded particles, pause while out of viewport, strict cleanup.
- Mouse response is subtle and desktop-only.

### GSAP behavior

- Hero reveal and scan timing.
- Text reveals and section transitions through `ScrollTrigger`.
- Small staggered entrances and restrained parallax.
- Motion honors `prefers-reduced-motion`; reduced mode has no pinned or looping animation.
- Any GSAP context is reverted on unmount.

### Microinteractions

- Button magnetic offset only on fine-pointer devices.
- Underline and CTA progress treatments.
- Integration icons and links react to focus and hover.
- No hover-only information or action is required on mobile.

## 6. Technical architecture

```text
website/
├── app/
│   ├── api/demo/route.ts
│   ├── (marketing)/
│   ├── contato/
│   └── ...service routes
├── components/
│   ├── layout/
│   ├── motion/
│   ├── sections/
│   ├── three/
│   └── ui/
├── content/
├── hooks/
├── lib/
├── public/
│   ├── icons/
│   ├── images/
│   ├── logos/
│   ├── models/
│   └── videos/
├── styles/
├── package.json
├── next.config.ts
└── tsconfig.json
```

The website owns its dependencies and lockfile. It is deployable to Vercel with `website` set as Root Directory.

## 7. Demo form and CRM handoff

1. A client form validates name, company, email, WhatsApp, consent, and an anti-spam honeypot.
2. It posts to the website’s own `POST /api/demo` route.
3. The route validates the payload with Zod, rate-limits by requester, and forwards the normalized JSON server-side to the existing CRM public inbound webhook.
4. The webhook URL is only read from `LUMENVA_CRM_WEBHOOK_URL` on the server; its token never enters client JavaScript.
5. If the CRM source is configured to require an HMAC, the optional server-only `LUMENVA_CRM_WEBHOOK_SECRET` signs the exact request body. No credentials are committed.
6. Success gives an accessible confirmation state; forwarding failure gives a safe retry message and is logged without personal data.

The Vercel project must receive the same variables through its environment configuration before the form can send real leads.

## 8. SEO, GEO, and AEO

- Per-route metadata, titles, descriptions, canonical URL from `NEXT_PUBLIC_SITE_URL`, Open Graph, and Twitter cards.
- `robots.ts`, `sitemap.ts`, semantic HTML, logical headings, breadcrumbs on inner routes.
- JSON-LD only for facts confirmed by the repository: `Organization`, `WebSite`, applicable `Service`, `BreadcrumbList`, and `FAQPage` where a visible FAQ exists.
- Clear entity language: Lumenva is the public brand for an open-source, self-hosted AI Sales OS that is WhatsApp-native.
- Focused service pages, direct answers, and citeable product facts; no keyword stuffing or invented company information.

## 9. Performance and accessibility requirements

- Mobile-first at 390 px; progressive enhancements above that size.
- Static markup and hero content render before optional 3D/motion modules.
- Next image optimization, dynamic imports, code splitting, optimized font loading, and no unnecessary video.
- The hero motion is disabled or simplified for small, low-power, save-data, and reduced-motion contexts.
- Keyboard-visible focus, semantic controls, meaningful labels, touch targets at least 44 px, sufficient contrast, and form error announcements.
- Validate at mobile, tablet, notebook, desktop, and large desktop sizes.

## 10. Verification plan

- Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` from `/website`.
- Verify every route and the demo form’s valid, invalid, rate-limited, and unavailable-webhook states.
- Browser-check the Home at 390 px plus desktop, including mobile navigation.
- Verify `prefers-reduced-motion` removes looping/pinned animation and preserves all content/actions.
- Validate generated metadata, robots, sitemap, canonical links, and JSON-LD structure.

## 11. Explicit exclusions and open content dependency

- No CRM, Supabase, authentication, or existing deployment changes.
- No fabricated metrics, customer logos, testimonials, screenshots, cases, prices, contact details, social profiles, legal information, or claims.
- A production Vercel deployment requires an authorized Vercel account plus a configured CRM webhook URL. It is not assumed available.
