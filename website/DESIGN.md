# Design System: Lumenva

## 1. Visual Theme & Atmosphere

Lumenva is a restrained, light-filled institutional site for an open-source, self-hosted AI Sales OS. It feels precise and editorial rather than decorative: broad whitespace, deliberate asymmetry, calm technical confidence, and a clear conversion path to a demonstration. Density is gallery-airy (3/10), variance is editorial and offset (6/10), and motion is restrained cinematic support (5/10). The monogram is always the protagonist; all visual effects must preserve reading order and clear spatial separation.

## 2. Color Palette & Roles

- **Lumen Blue** (`#0066CC`) — the single accent for primary actions, active states, focus rings, and essential links.
- **Lumen Blue Hover** (`#0071E3`) — interactive hover treatment for the accent.
- **Lumen Blue on Dark** (`#2997FF`) — accent treatment only where a dark supporting surface is introduced.
- **Lumen Ink** (`#1D1D1F`) — primary text and high-contrast structural detail.
- **Pure White** (`#FFFFFF`) — page and elevated surface.
- **Cloud Surface** (`#F5F5F7`) — quiet section background and structural contrast.
- **Mist Surface** (`#FAFAFC`) — subtle alternate surface.
- **True Black** (`#000000`) — reserved only as the approved semantic black token when essential; never use it as a page canvas or component-local color.

All colors are implemented as semantic CSS tokens in `styles/tokens.css`; components must never introduce arbitrary hex values. Alpha layers and shadows derive from these tokens.

## 3. Typography Rules

- **Brand and display:** Manrope, weight 700–800, tight tracking and controlled scale. The Lumenva monogram and wordmark use Manrope 800.
- **Body and interface:** Manrope, weight 500–700, comfortable line height, a maximum measure of 65 characters, and hierarchy through weight, spacing, and color instead of oversized type.
- **Technical labels:** system monospace, used sparingly for radar or agent labels only.
- **Responsive scale:** use `clamp()` for headings; body copy never drops below 1rem (16 px).
- **Banned:** Inter, script faces, serif variants, generic serif fonts, and typography that relies on faux metrics or decorative all-caps conventions.

## 4. Component Stylings

- **Primary CTA:** one decisive blue action per section, flat and tactile, with a small transform-only press response. No neon glow.
- **Secondary action:** understated text or outline treatment; do not create competing conversion paths.
- **Panels and cards:** use only when elevation communicates a genuine grouping. Favor editorial sequences, border-top dividers, and negative space. Never use a generic three-equal-card grid.
- **Forms:** labels sit above controls; accessible helper and error text sit below. All tap targets are at least 44 px.
- **Hero mark:** Manrope 800 `L` resolves first. In the final 10% of its reveal, a low-opacity circular scan behind it sweeps slowly and reveals three small found points. The radar remains visually subordinate. In reduced-motion mode, render the completed static state without loops.

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
- Publish only product facts confirmed in the repository: open source, self-hosted, WhatsApp-native, and human-governed AI agents.
- No emojis, AI-purple or neon aesthetics, outer-glow shadows, oversaturated accents, gradient headline text, custom cursors, generic placeholder names, filler scroll prompts, fake system metrics, or AI-copy clichés such as “Elevate,” “Seamless,” “Unleash,” or “Next-Gen.”
- No overlapping elements, centered high-variance hero, generic card grids, hover-only actions, or invented visual proof.

## 8. Stitch-Ready Enhanced Prompt

Create a mobile-first web landing page for Lumenva, the public brand for an open-source, self-hosted AI Sales OS that operates sales and support through WhatsApp. The page should feel like a calm, editorial technology publication: broad white space, confident left-aligned hierarchy, precise asymmetry, and a clear primary conversion to request a demonstration.

**DESIGN SYSTEM (REQUIRED):**
- Platform: Web, mobile-first from 390 px; single-column below 768 px with no horizontal overflow.
- Typography: Manrope throughout. Use Manrope 800 for the Lumenva monogram and wordmark; use 700–800 for compact display hierarchy and 500–700 for body/interface copy.
- Background: Pure White (`#FFFFFF`) with Cloud Surface (`#F5F5F7`) and Mist Surface (`#FAFAFC`) as quiet editorial breaks.
- Accent: Lumen Blue (`#0066CC`) only, with `#0071E3` hover and `#2997FF` only on dark support surfaces.
- Text: Lumen Ink (`#1D1D1F`) for primary text. Use semantic tokens only; no arbitrary component colors.
- Components: flat tactile primary CTA, restrained secondary action, editorial dividers and negative space instead of generic equal card grids; 44 px minimum touch targets and visible focus states.
- Motion: the `L` monogram settles first; only in the final 10% does a low-opacity radar sweep behind it and reveal three small points. The radar is subtle supporting motion and is static under reduced motion.

**Page Structure:**
1. Header with Manrope Lumenva wordmark, focused navigation, and one visible “Solicitar demonstração” CTA.
2. Asymmetric hero with the monogram/radar mark, concise factual positioning, primary demonstration CTA, and one GitHub secondary link.
3. Editorial proof band using only confirmed product properties: open source, self-hosted, WhatsApp-native, and human-governed agents.
4. Connected in-flow narrative explaining AI agents, automations, and CRM together; use typography, dividers, and whitespace rather than equal card grids.
5. Final CTA and factual footer.

Do not use a centered hero, Inter, serifs, neon or purple glow, gradients on headings, fabricated metrics, testimonials, customer logos, cases, contact data, prices, unsupported integrations, filler scroll cues, or overlapping elements.

## 9. Local Implementation Contract

`styles/tokens.css` is the local source of truth for the semantic color palette, typography, spacing, radius, elevation, z-index, layout, and motion tokens. `app/globals.css` imports the shared token, layout, and motion layers; future component and section styles consume those semantic properties rather than introducing local palette hex values. Manrope is loaded once by `app/layout.tsx` and exposed as `--font-manrope` for the typography layer.
