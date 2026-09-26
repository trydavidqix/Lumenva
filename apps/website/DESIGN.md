# Design System: Lumenva

## 1. Visual Theme & Atmosphere

Lumenva is a restrained, light-filled institutional site for an AI-powered sales and support platform (WhatsApp-native CRM with governed AI agents), positioned as a professional SaaS product — not an open-source/self-hosted pitch. It feels precise and editorial rather than decorative: broad whitespace, deliberate asymmetry, calm technical confidence, and a clear conversion path to a demonstration. Density is gallery-airy (3/10), variance is editorial and offset (6/10), and motion is restrained cinematic support (5/10). The headline copy is always the protagonist; all visual effects must preserve reading order and clear spatial separation.

## 2. Color Palette & Roles

Approved 2026-08-10 (`docs/brand/references/site/README.md`) — the brand is exclusively black, gray, and white. No chromatic accent.

- **Lumenva Black** (`#111111`) — headings, primary text, primary CTA fill, and high-contrast structural detail.
- **Lumenva Gray** (`#6E6E73`) — secondary text, icons, and support copy.
- **Lumenva White** (`#F5F5F7`) — page canvas and large surfaces.
- Neutral derivations only, for surface/border/hover/depth: `#FFFFFF`, `#FAFAFA`, `#E8E8ED`, `#D2D2D7`, `#AEAEB2`, `#8E8E93`, `#48484A`, `#3A3A3C`, `#2C2C2E`, `#1C1C1E`.
- **True Black** (`#000000`) — reserved only as the approved semantic black token when essential; never use it as a page canvas or component-local color.

No blue, green, purple, brown, neon, or gradient accents anywhere. All colors are implemented as semantic CSS tokens in `styles/tokens.css`; components must never introduce arbitrary hex values. Alpha layers and shadows derive from these tokens.

## 3. Typography Rules

- **Brand and display:** Manrope, weight 700–800, tight tracking and controlled scale. The Lumenva monogram and wordmark use Manrope 800.
- **Body and interface:** Manrope, weight 500–700, comfortable line height, a maximum measure of 65 characters, and hierarchy through weight, spacing, and color instead of oversized type.
- **Technical labels:** system monospace, used sparingly for radar or agent labels only.
- **Responsive scale:** use `clamp()` for headings; body copy never drops below 1rem (16 px).
- **Banned:** Inter, script faces, serif variants, generic serif fonts, and typography that relies on faux metrics or decorative all-caps conventions.

## 4. Component Stylings

- **Primary CTA:** one decisive black action per section, flat and tactile, with a small transform-only press response. No neon glow.
- **Secondary action:** understated text or outline treatment; do not create competing conversion paths.
- **Panels and cards:** use only when elevation communicates a genuine grouping. Favor editorial sequences, border-top dividers, and negative space. Never use a generic three-equal-card grid.
- **Forms:** labels sit above controls; accessible helper and error text sit below. All tap targets are at least 44 px.
- **Hero preview:** the hero pairs the headline copy with a decorative, static dashboard mockup (`AppWindow` + `SidebarNav` + stat cards + sparkline chart + pipeline list + activity feed), built from typed content only — never a literal app screenshot. The mockup window carries a visible "Pré-visualização ilustrativa" caption so illustrative figures are never mistaken for real product metrics by a reader, search engine, or AI crawler. The whole panel is `aria-hidden` since the surrounding copy already carries the value proposition. No canvas/WebGL in the hero critical path.
- **Hero integrations strip:** the pill row under the hero copy (`heroIntegrations` in `content/home.ts`) is labeled "Empresas com que trabalhamos" and shows the platforms/tools Lumenva integrates with (WhatsApp, OpenAI, Claude, n8n, Supabase, Vercel) — not customer/client logos, which stays banned per §7.

## 5. Layout Principles

- Start at 390 px. Use a single-column flow below 768 px; add only necessary tablet, notebook, desktop, and large-screen breakpoints.
- Use CSS Grid for multi-column structure; never percentage `calc()` layout hacks.
- Keep all content in clear in-flow zones: no overlapping copy, images, or controls.
- Contain broad desktop composition with a maximum width and generous section spacing that scales with `clamp(3rem, 8vw, 6rem)`.
- Desktop navigation collapses into a focused accessible mobile menu. No mobile horizontal overflow.
- The hero and all core content must render before optional motion or 3D enhancement.

## 6. Motion & Interaction

- Motion is progressive enhancement: respect `prefers-reduced-motion`, save-data, visibility, device capability, and low-power fallbacks.
- Use transform and opacity only. Default spring character: stiffness 100, damping 20. Never animate layout properties.
- GSAP reveals use restrained staggered orchestration and clean up contexts on unmount. Reduced motion has no pinned or looping animation.
- Mouse-reactive and magnetic effects operate only for fine pointers and never hide keyboard or touch affordances.

## 7. Content Integrity & Anti-Patterns

- Never fabricate metrics, testimonials, projects, cases, customer logos, screenshots, prices, contact details, social profiles, legal information, integrations, or product claims.
- Publish only product facts confirmed in the repository: WhatsApp-native channel, CRM with multi-tenant isolation, and human-governed AI agents. Do not reintroduce open-source/self-hosted/MIT-license framing — removed by explicit decision so the site reads as a professional SaaS product.
- Any illustrative figure in a mockup (dashboard numbers, chart values) must carry a visible "ilustrativo" caption so it is never machine-read as a real, factual claim about the product.
- No emojis, AI-purple or neon aesthetics, outer-glow shadows, oversaturated accents, gradient headline text, custom cursors, generic placeholder names, filler scroll prompts, fake system metrics, or AI-copy clichés such as “Elevate,” “Seamless,” “Unleash,” or “Next-Gen.”
- No overlapping elements, centered high-variance hero, generic card grids, hover-only actions, or invented visual proof.

## 8. Stitch-Ready Enhanced Prompt

Create a mobile-first web landing page for Lumenva, an AI-powered sales and support platform that operates through WhatsApp, positioned as a professional SaaS product. The page should feel like a calm, editorial technology publication: broad white space, confident left-aligned hierarchy, precise asymmetry, and a clear primary conversion to request a demonstration.

**DESIGN SYSTEM (REQUIRED):**
- Platform: Web, mobile-first from 390 px; single-column below 768 px with no horizontal overflow.
- Typography: Manrope throughout. Use Manrope 800 for the Lumenva monogram and wordmark; use 700–800 for compact display hierarchy and 500–700 for body/interface copy.
- Background: Pure White (`#FFFFFF`) with Lumenva White (`#F5F5F7`) and Mist Surface (`#FAFAFA`) as quiet editorial breaks.
- Accent: Lumenva Black (`#111111`) only, with `#2C2C2E` hover. No chromatic accent anywhere.
- Text: Lumenva Black (`#111111`) for primary text, Lumenva Gray (`#6E6E73`) for secondary text. Use semantic tokens only; no arbitrary component colors.
- Components: flat tactile primary CTA, restrained secondary action, editorial dividers and negative space instead of generic equal card grids; 44 px minimum touch targets and visible focus states.
- Motion: fade/reveal and small translations only, transform/opacity, static under reduced motion. No canvas/WebGL in the hero critical path.

**Page Structure:**
1. Header with Manrope Lumenva wordmark, focused navigation (Produto, Soluções with dropdown, Integrações, Contacto), and one visible “Agendar demonstração” CTA.
2. Asymmetric hero: headline/CTA copy paired with a decorative static dashboard mockup, concise factual positioning, primary demonstration CTA, and a secondary “Ver produto” link.
3. Editorial proof band using only confirmed product properties: multi-tenant CRM, WhatsApp-native, and human-governed agents.
4. Connected in-flow narrative explaining AI agents, automations, and CRM together; use typography, dividers, and whitespace rather than equal card grids.
5. Final CTA and factual footer.

Do not use a centered hero, Inter, serifs, neon or purple glow, gradients on headings, fabricated metrics, testimonials, customer logos, cases, unsupported contact data, prices, unsupported integrations, filler scroll cues, or overlapping elements. Mockup figures must be visibly labeled illustrative.

## 9. Local Implementation Contract

`styles/tokens.css` is the local source of truth for the semantic color palette, typography, spacing, radius, elevation, z-index, layout, and motion tokens. `app/globals.css` imports the shared token, layout, and motion layers; future component and section styles consume those semantic properties rather than introducing local palette hex values. Manrope is loaded once by `app/layout.tsx` and exposed as `--font-manrope` for the typography layer.

`app/icon.tsx` renders the favicon at request time via `next/og`'s `ImageResponse`, reading `public/brand/lumenva-mark-favicon.png` as a base64 data URI. That decoder only accepts plain RGB/RGBA PNGs — an indexed/palette PNG (or one with extra ancillary chunks like `eXIf`) fails at request time with a 500 (`Input buffer contains unsupported image format`), not at build time. Any replacement of that source PNG must stay 8-bit RGBA with no palette/indexed color type.
