# Fundação Visual Lumenva CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sage (green) palette and Atkinson Hyperlegible typography with the approved Lumenva identity (black/gray/white palette, system font stack) across the CRM's design tokens, without touching any individual module/component.

**Architecture:** All product screens read color/radius/shadow through CSS custom properties (`app/globals.css`) consumed via `tailwind.config.ts` token mappings — no component touches a raw hex value. Typography is loaded once in `app/layout.tsx` via `next/font/google` and exposed as `--font-atkinson`, consumed by `tailwind.config.ts` `fontFamily.sans`. Because both surfaces are centralized, the palette/typography swap is two small edit sites (`app/globals.css`, `app/layout.tsx` + `tailwind.config.ts`) plus the design-tool/reference copies (`app/design/lib/tokens.ts`, `app/design/lib/fonts.ts`, `docs/design-system/`) that describe them for humans and for the `/design` showcase route.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS (CSS-var-driven theme), `next/font/google`, TypeScript.

## Global Constraints

- Branch `gpt-lumenva-crm-ui` only. Worktree: `C:\Users\david\Desktop\Projetos\CRM-lumenva-crm-ui`. Never touch `website/` or `main`.
- Brand palette limited to `#111111` / `#6E6E73` / `#F5F5F7` + approved neutral derivations (`#FFFFFF`, `#FAFAFA`, `#E8E8ED`, `#D2D2D7`, `#AEAEB2`, `#8E8E93`, `#48484A`, `#3A3A3C`, `#2C2C2E`, `#1C1C1E`) — do not invent hex values outside this list for brand/neutral tokens.
- Semantic exception: `error`/`success`/`warning` keep minimal color accent (red/green/amber), always paired with icon + text, never color-only (per approved spec §2.1).
- Radius scale: `sm=8px`, `md=12px`, `lg=16px` (per spec §4). `full` (999px) and any untouched existing token (`none`, `xl`) are out of scope.
- Typography family: system stack `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Type scale/weights unchanged — only the family swaps.
- Iconography (Phosphor duotone) and density (Aerada / row 56 / gap 24) are explicitly out of scope — do not touch `05-iconography-phosphor.md`, `04-density-aerada.md`, or any `DENSITIES`/icon code.
- Dark mode: tokens only, no toggle UI/persistence in this plan.
- No component file under `components/**` or `app/(admin)/**` etc. is touched — this plan is tokens + docs only.
- After every task: `pnpm typecheck` and `pnpm lint` must pass before commit.
- Every commit message is scoped to what that task changed (no bundling).

---

### Task 1: Lumenva palette in `app/design/lib/tokens.ts`

**Files:**
- Modify: `app/design/lib/tokens.ts:5` (type `PaletteId`)
- Modify: `app/design/lib/tokens.ts:40-68` (rename `sage` entry to `lumenva`)

**Interfaces:**
- Produces: `PALETTES.lumenva: PaletteDef` (same shape as other entries — `accent`, `neutralLight`, `neutralDark`, `states`, `surfaces`), replacing `PALETTES.sage`. `PaletteId` union now includes `"lumenva"` instead of `"sage"`.
- Consumes: existing `PaletteDef`/`ColorScale`/`StateColors` types (unchanged, `app/design/lib/tokens.ts:10-36`).

- [ ] **Step 1: Update the `PaletteId` type**

In `app/design/lib/tokens.ts:5`, replace:

```ts
export type PaletteId = "sage" | "clay" | "mist" | "plum" | "olive";
```

with:

```ts
export type PaletteId = "lumenva" | "clay" | "mist" | "plum" | "olive";
```

- [ ] **Step 2: Replace the `sage` entry with `lumenva`**

In `app/design/lib/tokens.ts:40-68`, replace the `sage:` block (from `sage: {` through its closing `},` right before `clay: {`) with:

```ts
  lumenva: {
    id: "lumenva",
    name: "Lumenva",
    description: "Preto, cinzento e branco. Identidade única da marca — sem família cromática de accent.",
    // Marca não tem accent cromático: o "accent" é a própria escala de cinza da marca.
    accent: {
      50: "#fafafa", 100: "#f5f5f7", 200: "#e8e8ed", 300: "#d2d2d7",
      400: "#aeaeb2", 500: "#8e8e93", 600: "#6e6e73", 700: "#48484a",
      800: "#3a3a3c", 900: "#2c2c2e", 950: "#1c1c1e",
    },
    neutralLight: {
      50: "#fafafa", 100: "#f5f5f7", 200: "#e8e8ed", 300: "#d2d2d7",
      400: "#aeaeb2", 500: "#8e8e93", 600: "#6e6e73", 700: "#48484a",
      800: "#3a3a3c", 900: "#2c2c2e", 950: "#1c1c1e",
    },
    neutralDark: {
      50: "#f5f5f7", 100: "#e8e8ed", 200: "#aeaeb2", 300: "#8e8e93",
      400: "#6e6e73", 500: "#48484a", 600: "#3a3a3c", 700: "#2c2c2e",
      800: "#1c1c1e", 900: "#111111", 950: "#111111",
    },
    states: {
      // info não recebe hue própria (evita 4ª família cromática): usa o cinza mais escuro do texto.
      light: { success: "#2e7d46", warning: "#a9660b", error: "#b3261e", info: "#48484a" },
      dark:  { success: "#5fb37a", warning: "#e0973b", error: "#ff6259", info: "#aeaeb2" },
    },
    surfaces: {
      light: { bg: "#f5f5f7", surface: "#ffffff", surfaceElevated: "#fafafa", text: "#111111", textMuted: "#6e6e73", border: "#e8e8ed" },
      dark:  { bg: "#111111", surface: "#1c1c1e", surfaceElevated: "#2c2c2e", text: "#f5f5f7", textMuted: "#aeaeb2", border: "#3a3a3c" },
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors referencing `PALETTES.sage` or `PaletteId`. If any consumer still references `"sage"` as a literal (e.g. a default-selected palette in a showcase component), fix that reference to `"lumenva"` — grep first: `grep -rn '"sage"' app/design`.

- [ ] **Step 4: Commit**

```bash
git add app/design/lib/tokens.ts
git commit -m "feat(design): replace Sage palette with Lumenva (black/gray/white) tokens"
```

---

### Task 2: System font stack in the `/design` showcase (`app/design/lib/tokens.ts` + `app/design/lib/fonts.ts`)

**Files:**
- Modify: `app/design/lib/tokens.ts:6` (type `TypoId`)
- Modify: `app/design/lib/tokens.ts:210-217` (rename `atkinson` entry to `system-ui`)
- Modify: `app/design/lib/fonts.ts:1-11,41-46,74-84` (remove `Atkinson_Hyperlegible` loader)

**Interfaces:**
- Produces: `TYPOS["system-ui"]` entry (same shape as siblings — `name`, `display`, `body`, `mono`, `description`, `scale`), replacing `TYPOS.atkinson`. `TypoId` union now includes `"system-ui"` instead of `"atkinson"`.
- Consumes: existing `TYPOS` record shape (`app/design/lib/tokens.ts:193`, unchanged).

- [ ] **Step 1: Update the `TypoId` type**

In `app/design/lib/tokens.ts:6`, replace:

```ts
export type TypoId = "bricolage-jakarta" | "fraunces-manrope" | "atkinson" | "source-plex";
```

with:

```ts
export type TypoId = "bricolage-jakarta" | "fraunces-manrope" | "system-ui" | "source-plex";
```

- [ ] **Step 2: Replace the `atkinson` TYPOS entry with `system-ui`**

In `app/design/lib/tokens.ts:210-217`, replace:

```ts
  "atkinson": {
    name: "Atkinson Hyperlegible",
    display: '"Atkinson Hyperlegible", system-ui, sans-serif',
    body: '"Atkinson Hyperlegible", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    description: "Acessibilidade-first. Glifos diferenciados, mesma família display+body.",
    scale: 1.2,
  },
```

with:

```ts
  "system-ui": {
    name: "System UI (Lumenva)",
    display: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    description: "Fonte nativa do SO. Zero custo de carregamento, renderização Apple-real em Mac, self-host coerente em qualquer OS.",
    scale: 1.2,
  },
```

- [ ] **Step 3: Remove the Atkinson font loader from `app/design/lib/fonts.ts`**

Remove `Atkinson_Hyperlegible` from the `next/font/google` import (`app/design/lib/fonts.ts:1-11`):

```ts
import {
  Bricolage_Grotesque,
  Plus_Jakarta_Sans,
  Fraunces,
  Manrope,
  Source_Serif_4,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  JetBrains_Mono,
} from "next/font/google";
```

Remove the `atkinson` export block (`app/design/lib/fonts.ts:41-46`):

```ts
export const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-atkinson",
});
```

Remove `atkinson.variable` from `allFontVariables` (`app/design/lib/fonts.ts:74-84`):

```ts
export const allFontVariables = [
  bricolage.variable,
  jakarta.variable,
  fraunces.variable,
  manrope.variable,
  sourceSerif.variable,
  plexSans.variable,
  plexMono.variable,
  jetbrains.variable,
].join(" ");
```

- [ ] **Step 4: Grep for stale references**

Run: `grep -rn "atkinson\|Atkinson" app/design --include=*.ts --include=*.tsx`
Expected: no remaining reference to `atkinson`/`Atkinson_Hyperlegible` in `app/design/**` (component code that picks a `TypoId`/renders `var(--font-atkinson)` for the showcase must be updated to `"system-ui"` if any match appears).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/design/lib/tokens.ts app/design/lib/fonts.ts
git commit -m "feat(design): replace Atkinson Hyperlegible with system font stack in showcase"
```

---

### Task 3: Real app — drop Atkinson font load in `app/layout.tsx`

**Files:**
- Modify: `app/layout.tsx:1-22`
- Modify: `app/layout.tsx:74` (className)

**Interfaces:**
- Consumes: nothing new.
- Produces: `<html>` no longer carries `--font-atkinson`; `plexMono`'s `--font-mono` is untouched (mono font is out of scope).

- [ ] **Step 1: Remove the Atkinson import and loader**

In `app/layout.tsx:1-22`, replace:

```tsx
import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { branding } from "@/lib/branding";
import { ThemeProvider } from "@/lib/theme";
import { Providers } from "./providers";
import { PublicEnvScript } from "./public-env-script";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-atkinson",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});
```

with:

```tsx
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { branding } from "@/lib/branding";
import { ThemeProvider } from "@/lib/theme";
import { Providers } from "./providers";
import { PublicEnvScript } from "./public-env-script";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});
```

- [ ] **Step 2: Drop `atkinson.variable` from the `<html>` className**

At `app/layout.tsx:74`, replace:

```tsx
      className={`${atkinson.variable} ${plexMono.variable}`}
```

with:

```tsx
      className={plexMono.variable}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (confirm no other file imports `atkinson` from `app/layout.tsx` — it wasn't exported, so this is safe by construction).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(design): drop Atkinson Hyperlegible font load from root layout"
```

---

### Task 4: `tailwind.config.ts` — system font stack for `font-sans`

**Files:**
- Modify: `tailwind.config.ts` (the `fontFamily.sans` array, currently `var(--font-atkinson), ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`)

**Interfaces:**
- Consumes: nothing (static config).
- Produces: `font-sans` Tailwind utility (applied on `<body>` in `app/layout.tsx:81`) now resolves to the system stack directly, no CSS var indirection.

- [ ] **Step 1: Replace `fontFamily.sans`**

In `tailwind.config.ts`, replace:

```ts
      fontFamily: {
        sans: [
          "var(--font-atkinson)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
```

with:

```ts
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
```

(leave the `mono: [...]` block directly below untouched.)

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(design): point font-sans at system font stack instead of Atkinson var"
```

---

### Task 5: `app/globals.css` — Lumenva color tokens (light + dark) and radius

**Files:**
- Modify: `app/globals.css:5-9` (header comment)
- Modify: `app/globals.css:11-42` (`:root` surfaces/text/border/accent)
- Modify: `app/globals.css:57-69` (`:root` states)
- Modify: `app/globals.css:87-93` (`:root` radius)
- Modify: `app/globals.css:95-100` (`:root` shadow)
- Modify: `app/globals.css:146-204` (`[data-theme="dark"]` surfaces/text/border/accent/states)
- Modify: `app/globals.css:206-211` (`[data-theme="dark"]` shadow)
- Modify: `app/globals.css:246-255` (`body` font-family)

**Interfaces:**
- Consumes: nothing (raw CSS custom properties).
- Produces: `--color-*`, `--radius-sm/md/lg`, `--shadow-*` consumed by `tailwind.config.ts` (`app/globals.css` is the single source these map to — no change needed in `tailwind.config.ts` color/shadow sections, they already read via `var(--color-*)`/`var(--shadow-*)`).

- [ ] **Step 1: Update the header comment**

In `app/globals.css:5-9`, replace:

```css
/* ─────────────────────────────────────────────────────────────────────────
   DeskcommCRM — Design System tokens (Sage palette · density Aerada)
   Source of truth: /app/design/lib/tokens.ts (PALETTES.sage)
   Light + dark drawn separately (NOT inverted).
   ───────────────────────────────────────────────────────────────────────── */
```

with:

```css
/* ─────────────────────────────────────────────────────────────────────────
   Lumenva CRM — Design System tokens (Lumenva palette · density Aerada)
   Source of truth: /app/design/lib/tokens.ts (PALETTES.lumenva)
   Light + dark drawn separately (NOT inverted).
   ───────────────────────────────────────────────────────────────────────── */
```

- [ ] **Step 2: Replace `:root` surfaces, text, border, accent (light)**

In `app/globals.css:11-42`, replace:

```css
:root {
  /* Surfaces (light) */
  --color-bg: #faf9f6;
  --color-surface: #ffffff;
  --color-surface-elevated: #f5f3ee;
  --color-overlay: rgba(28, 26, 22, 0.42);

  /* Text (light) */
  --color-text: #1c1a16;
  --color-text-muted: #5d594f;
  --color-text-subtle: #7d786c;

  /* Borders (light) */
  --color-border: #e7e3da;
  --color-border-strong: #d2cdbf;

  /* Accent — Sage (11 stops) */
  --color-accent-50:  #f3f6f1;
  --color-accent-100: #e4ebe0;
  --color-accent-200: #c8d6c1;
  --color-accent-300: #a4ba9a;
  --color-accent-400: #82a077;
  --color-accent-500: #67885d;
  --color-accent-600: #506d48;
  --color-accent-700: #41573b;
  --color-accent-800: #374731;
  --color-accent-900: #2f3c2b;
  --color-accent-950: #171f15;
  --color-accent: var(--color-accent-600);
  --color-accent-fg: #ffffff;
  --color-accent-soft: var(--color-accent-100);
  --color-accent-hover: var(--color-accent-700);

  /* Neutrals — greige (11 stops, light) */
  --color-neutral-50:  #faf9f6;
  --color-neutral-100: #f3f1ec;
  --color-neutral-200: #e7e3da;
  --color-neutral-300: #d2cdbf;
  --color-neutral-400: #a9a395;
  --color-neutral-500: #7d786c;
  --color-neutral-600: #5d594f;
  --color-neutral-700: #46433b;
  --color-neutral-800: #2e2c26;
  --color-neutral-900: #1c1a16;
  --color-neutral-950: #0e0d0a;
```

with:

```css
:root {
  /* Surfaces (light) */
  --color-bg: #f5f5f7;
  --color-surface: #ffffff;
  --color-surface-elevated: #fafafa;
  --color-overlay: rgba(17, 17, 17, 0.42);

  /* Text (light) */
  --color-text: #111111;
  --color-text-muted: #6e6e73;
  --color-text-subtle: #8e8e93;

  /* Borders (light) */
  --color-border: #e8e8ed;
  --color-border-strong: #d2d2d7;

  /* Accent — Lumenva gray scale (marca não tem accent cromático) */
  --color-accent-50:  #fafafa;
  --color-accent-100: #f5f5f7;
  --color-accent-200: #e8e8ed;
  --color-accent-300: #d2d2d7;
  --color-accent-400: #aeaeb2;
  --color-accent-500: #8e8e93;
  --color-accent-600: #6e6e73;
  --color-accent-700: #48484a;
  --color-accent-800: #3a3a3c;
  --color-accent-900: #2c2c2e;
  --color-accent-950: #1c1c1e;
  --color-accent: #111111;
  --color-accent-fg: #ffffff;
  --color-accent-soft: var(--color-accent-100);
  --color-accent-hover: #2c2c2e;

  /* Neutrals — Lumenva gray (11 stops, light) */
  --color-neutral-50:  #fafafa;
  --color-neutral-100: #f5f5f7;
  --color-neutral-200: #e8e8ed;
  --color-neutral-300: #d2d2d7;
  --color-neutral-400: #aeaeb2;
  --color-neutral-500: #8e8e93;
  --color-neutral-600: #6e6e73;
  --color-neutral-700: #48484a;
  --color-neutral-800: #3a3a3c;
  --color-neutral-900: #2c2c2e;
  --color-neutral-950: #1c1c1e;
```

Note: `--color-accent` moves from a mid-scale stop (`600`) to `#111111` (Lumenva Black) directly — the brand's primary button/link color per the identity spec (§3.1, "Lumenva Black: Texto principal, botões primários"), not a derived gray stop.

- [ ] **Step 3: Replace `:root` states (light)**

In `app/globals.css:57-69`, replace:

```css
  /* States (light) */
  --color-success: #5a8a5f;
  --color-success-bg: rgba(90, 138, 95, 0.12);
  --color-success-fg: #41673f;
  --color-warning: #b07a2b;
  --color-warning-bg: rgba(176, 122, 43, 0.12);
  --color-warning-fg: #875a1a;
  --color-error: #a94a3c;
  --color-error-bg: rgba(169, 74, 60, 0.12);
  --color-error-fg: #8a3a2e;
  --color-info: #4a7a93;
  --color-info-bg: rgba(74, 122, 147, 0.12);
  --color-info-fg: #355d72;
```

with:

```css
  /* States (light) — cor é sempre reforço, nunca único canal (ícone + texto obrigatórios) */
  --color-success: #2e7d46;
  --color-success-bg: rgba(46, 125, 70, 0.12);
  --color-success-fg: #1f5c33;
  --color-warning: #a9660b;
  --color-warning-bg: rgba(169, 102, 11, 0.12);
  --color-warning-fg: #7a4a08;
  --color-error: #b3261e;
  --color-error-bg: rgba(179, 38, 30, 0.12);
  --color-error-fg: #8c1d17;
  /* info não recebe hue própria (evita 4ª família cromática): usa o cinza mais escuro do texto */
  --color-info: #48484a;
  --color-info-bg: rgba(72, 72, 74, 0.10);
  --color-info-fg: #2c2c2e;
```

- [ ] **Step 4: Update `:root` radius**

In `app/globals.css:87-93`, replace:

```css
  /* Radius */
  --radius-none: 0px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
```

with:

```css
  /* Radius */
  --radius-none: 0px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 16px;
  --radius-full: 9999px;
```

- [ ] **Step 5: Update `:root` shadow tokens (rgba base moves from warm-dark to Lumenva Black)**

In `app/globals.css:95-100`, replace:

```css
  /* Shadows — desaturated, neutral-based */
  --shadow-xs: 0 1px 2px 0 rgba(20, 18, 14, 0.04);
  --shadow-sm: 0 1px 2px 0 rgba(20, 18, 14, 0.05), 0 1px 1px 0 rgba(20, 18, 14, 0.03);
  --shadow-md: 0 4px 12px -2px rgba(20, 18, 14, 0.06), 0 2px 4px -1px rgba(20, 18, 14, 0.04);
  --shadow-lg: 0 12px 32px -6px rgba(20, 18, 14, 0.10), 0 4px 12px -2px rgba(20, 18, 14, 0.06);
  --shadow-xl: 0 24px 48px -12px rgba(20, 18, 14, 0.16), 0 8px 16px -4px rgba(20, 18, 14, 0.08);
```

with:

```css
  /* Shadows — quase imperceptíveis (spec identidade §5), base rgba = Lumenva Black */
  --shadow-xs: 0 1px 1px 0 rgba(17, 17, 17, 0.03);
  --shadow-sm: 0 1px 2px 0 rgba(17, 17, 17, 0.04);
  --shadow-md: 0 4px 16px 0 rgba(17, 17, 17, 0.08);
  --shadow-lg: 0 8px 24px -4px rgba(17, 17, 17, 0.10);
  --shadow-xl: 0 16px 40px -8px rgba(17, 17, 17, 0.12);
```

`--shadow-sm`/`--shadow-md` match the exact values fixed in the approved spec (§5); `xs`/`lg`/`xl` are not specced individually and are interpolated on the same curve, staying below the spec's "nada de efeito chamativo" ceiling.

- [ ] **Step 6: Replace `[data-theme="dark"]` surfaces, text, border, accent**

In `app/globals.css:146-177`, replace:

```css
[data-theme="dark"] {
  /* Surfaces (dark — drawn) */
  --color-bg: #161510;
  --color-surface: #1d1c17;
  --color-surface-elevated: #272620;
  --color-overlay: rgba(0, 0, 0, 0.55);

  /* Text (dark) */
  --color-text: #f5f4ef;
  --color-text-muted: #8e8b7f;
  --color-text-subtle: #605e54;

  /* Borders (dark) */
  --color-border: #33312a;
  --color-border-strong: #444239;

  /* Accent stays same hex stops; default shifts up for dark contrast */
  --color-accent-50:  #f3f6f1;
  --color-accent-100: #e4ebe0;
  --color-accent-200: #c8d6c1;
  --color-accent-300: #a4ba9a;
  --color-accent-400: #82a077;
  --color-accent-500: #67885d;
  --color-accent-600: #506d48;
  --color-accent-700: #41573b;
  --color-accent-800: #374731;
  --color-accent-900: #2f3c2b;
  --color-accent-950: #171f15;
  --color-accent: var(--color-accent-400);
  --color-accent-fg: #161510;
  --color-accent-soft: rgba(130, 160, 119, 0.16);
  --color-accent-hover: var(--color-accent-300);
```

with:

```css
[data-theme="dark"] {
  /* Surfaces (dark — drawn, not inverted) */
  --color-bg: #111111;
  --color-surface: #1c1c1e;
  --color-surface-elevated: #2c2c2e;
  --color-overlay: rgba(0, 0, 0, 0.6);

  /* Text (dark) */
  --color-text: #f5f5f7;
  --color-text-muted: #aeaeb2;
  --color-text-subtle: #8e8e93;

  /* Borders (dark) */
  --color-border: #3a3a3c;
  --color-border-strong: #48484a;

  /* Accent — Lumenva gray scale, same stops as light; default shifts for dark contrast */
  --color-accent-50:  #fafafa;
  --color-accent-100: #f5f5f7;
  --color-accent-200: #e8e8ed;
  --color-accent-300: #d2d2d7;
  --color-accent-400: #aeaeb2;
  --color-accent-500: #8e8e93;
  --color-accent-600: #6e6e73;
  --color-accent-700: #48484a;
  --color-accent-800: #3a3a3c;
  --color-accent-900: #2c2c2e;
  --color-accent-950: #1c1c1e;
  --color-accent: #f5f5f7;
  --color-accent-fg: #111111;
  --color-accent-soft: rgba(245, 245, 247, 0.12);
  --color-accent-hover: #e8e8ed;
```

- [ ] **Step 7: Replace `[data-theme="dark"]` states**

In `app/globals.css:192-204`, replace:

```css
  /* States (dark) */
  --color-success: #82a077;
  --color-success-bg: rgba(130, 160, 119, 0.18);
  --color-success-fg: #a4ba9a;
  --color-warning: #d09455;
  --color-warning-bg: rgba(208, 148, 85, 0.18);
  --color-warning-fg: #e0ad77;
  --color-error: #c87263;
  --color-error-bg: rgba(200, 114, 99, 0.18);
  --color-error-fg: #d99182;
  --color-info: #7da9bf;
  --color-info-bg: rgba(125, 169, 191, 0.18);
  --color-info-fg: #9bbfd2;
```

with:

```css
  /* States (dark) */
  --color-success: #5fb37a;
  --color-success-bg: rgba(95, 179, 122, 0.18);
  --color-success-fg: #8ecda2;
  --color-warning: #e0973b;
  --color-warning-bg: rgba(224, 151, 59, 0.18);
  --color-warning-fg: #eab672;
  --color-error: #ff6259;
  --color-error-bg: rgba(255, 98, 89, 0.18);
  --color-error-fg: #ff9089;
  --color-info: #aeaeb2;
  --color-info-bg: rgba(174, 174, 178, 0.14);
  --color-info-fg: #e8e8ed;
```

- [ ] **Step 8: Update `[data-theme="dark"]` shadow tokens**

In `app/globals.css:206-211`, replace:

```css
  /* Shadows — heavier in dark */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.30);
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.40), 0 1px 1px 0 rgba(0, 0, 0, 0.20);
  --shadow-md: 0 4px 12px -2px rgba(0, 0, 0, 0.45), 0 2px 4px -1px rgba(0, 0, 0, 0.30);
  --shadow-lg: 0 12px 32px -6px rgba(0, 0, 0, 0.55), 0 4px 12px -2px rgba(0, 0, 0, 0.40);
  --shadow-xl: 0 24px 48px -12px rgba(0, 0, 0, 0.65), 0 8px 16px -4px rgba(0, 0, 0, 0.50);
```

with:

```css
  /* Shadows — heavier in dark (elevation cue against near-black bg; light stays the "quase imperceptível" reference) */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.24);
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.32);
  --shadow-md: 0 4px 16px 0 rgba(0, 0, 0, 0.40);
  --shadow-lg: 0 8px 24px -4px rgba(0, 0, 0, 0.48);
  --shadow-xl: 0 16px 40px -8px rgba(0, 0, 0, 0.56);
```

- [ ] **Step 9: Update the `body` font-family rule**

In `app/globals.css:246-255`, replace:

```css
  body {
    background-color: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-atkinson), ui-sans-serif, system-ui, -apple-system,
      "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-feature-settings: "rlig" 1, "calt" 1, "ss01" 1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
```

with:

```css
  body {
    background-color: var(--color-bg);
    color: var(--color-text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    font-feature-settings: "rlig" 1, "calt" 1, "ss01" 1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
```

- [ ] **Step 10: Visual smoke check locally**

Run: `pnpm dev` (in the worktree), open `http://localhost:3000` and any authenticated dashboard/inbox screen already reachable with a test account.
Expected: background is light gray/white (not warm-beige), text is near-black (not warm-brown-black), no green accent visible anywhere primary buttons/links render, shadows read as faint (not heavy/dark), dark mode (`<html data-theme="dark">` via devtools) shows near-black background with light-gray text. Stop the dev server when done.

- [ ] **Step 11: Typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add app/globals.css
git commit -m "feat(design): replace Sage CSS tokens with Lumenva palette, update radius/shadow scale"
```

---

### Task 6: `docs/design-system/00-overview.md` and `README.md` — version bump to v2.0

**Files:**
- Modify: `docs/design-system/00-overview.md:24,41`
- Modify: `docs/design-system/README.md:3,6,16-17,29,48`

**Interfaces:** None (documentation only).

- [ ] **Step 1: Update `00-overview.md` accessibility line**

At `docs/design-system/00-overview.md:24`, replace:

```markdown
4. **Accessibility > aesthetic.** WCAG AA é piso, não teto. Atkinson Hyperlegible foi escolhida pela disambiguação de glifos. Focus rings sempre 2px visíveis.
```

with:

```markdown
4. **Accessibility > aesthetic.** WCAG AA é piso, não teto. A fonte de sistema garante renderização nativa e legível em qualquer SO self-hosted. Focus rings sempre 2px visíveis.
```

- [ ] **Step 2: Update the versioning section**

At `docs/design-system/00-overview.md:41`, replace:

```markdown
- **v1.0 — locked em 2026-04-28.** As 5 escolhas (Sage, Atkinson, Aerada, Phosphor, IBM Plex Mono) estão fechadas até v2.0. PRs que tentem trocar uma delas precisam de RFC.
```

with:

```markdown
- **v2.0 — 2026-08-11.** Paleta Lumenva (preto/cinza/branco) e tipografia system-ui substituem Sage e Atkinson Hyperlegible, por decisão de identidade visual aprovada em `docs/superpowers/specs/2026-08-10-lumenva-identidade-visual-design.md`. Aerada, Phosphor e IBM Plex Mono permanecem lockados desde v1.0 (2026-04-28); trocá-los ainda exige RFC.
```

- [ ] **Step 3: Update `README.md` header block**

At `docs/design-system/README.md:3-6`, replace:

```markdown
> **Versão:** v1.0 (lockada em 2026-04-28)
> **Status:** Ativa
> **Direção:** Soft-tech / calmo, anti-genérico
> **Stack visual:** Sage + Atkinson Hyperlegible + IBM Plex Mono + Aerada + Phosphor (duotone)
```

with:

```markdown
> **Versão:** v2.0 (2026-08-11)
> **Status:** Ativa
> **Direção:** Apple-inspired premium, luxury, profissional, confortável
> **Stack visual:** Lumenva (preto/cinza/branco) + System UI + IBM Plex Mono + Aerada + Phosphor (duotone)
```

- [ ] **Step 4: Update the index table row for the palette doc**

At `docs/design-system/README.md:16-17`, replace:

```markdown
| 02 | [Paleta Sage](./02-palette-sage.md) | 22 stops com hex (light + dark), estados, contraste |
| 03 | [Tipografia](./03-typography.md) | Atkinson Hyperlegible, escala, IBM Plex Mono |
```

with:

```markdown
| 02 | [Paleta Lumenva](./02-palette-lumenva.md) | 22 stops com hex (light + dark), estados, contraste |
| 03 | [Tipografia](./03-typography.md) | System UI, escala, IBM Plex Mono |
```

- [ ] **Step 5: Update the "mapa decisão" row**

At `docs/design-system/README.md:29`, replace:

```markdown
| Cor (hex, stop, estado) | `02-palette-sage.md` + `app/design/lib/tokens.ts` | Sempre que precisar referenciar uma cor |
```

with:

```markdown
| Cor (hex, stop, estado) | `02-palette-lumenva.md` + `app/design/lib/tokens.ts` | Sempre que precisar referenciar uma cor |
```

- [ ] **Step 6: Update the versioning section**

At `docs/design-system/README.md:48`, replace:

```markdown
- **v1.0** (2026-04-28) — paleta Sage, tipografia Atkinson, densidade Aerada, iconografia Phosphor lockados.
```

with:

```markdown
- **v2.0** (2026-08-11) — paleta Lumenva (preto/cinza/branco) e tipografia system-ui substituem Sage/Atkinson. Densidade Aerada e iconografia Phosphor permanecem lockadas desde v1.0 (2026-04-28).
```

- [ ] **Step 7: Commit**

```bash
git add docs/design-system/00-overview.md docs/design-system/README.md
git commit -m "docs(design-system): bump design system to v2.0 (Lumenva palette, system-ui typography)"
```

---

### Task 7: Rename and rewrite `docs/design-system/02-palette-sage.md` → `02-palette-lumenva.md`

**Files:**
- Create: `docs/design-system/02-palette-lumenva.md`
- Delete: `docs/design-system/02-palette-sage.md`

**Interfaces:** None (documentation only). Content mirrors `app/globals.css` tokens from Task 5 and `app/design/lib/tokens.ts` `PALETTES.lumenva` from Task 1.

- [ ] **Step 1: Create the new file**

Create `docs/design-system/02-palette-lumenva.md`:

```markdown
# 02 — Paleta Lumenva

> **Source of truth:** `app/design/lib/tokens.ts` → `PALETTES.lumenva`

## Filosofia da paleta

Lumenva usa apenas preto, cinzento e branco — sem família cromática de accent. A identidade da marca (`docs/superpowers/specs/2026-08-10-lumenva-identidade-visual-design.md`) é explícita: reconhecimento e confiança concentram-se numa única marca monocromática, Apple-inspired, sem competir com decoração.

- **Conforto sem frieza** — o fundo principal é `#F5F5F7` (light), nunca branco puro em área grande; o "accent" funcional é o próprio preto da marca (`#111111`), não um tom intermediário de cinza.
- **~70-80% claro** — light é a referência principal; dark é alternativa premium, não a identidade dominante.
- **Anti-genérico por ausência, não por adição** — a maioria dos CRMs SaaS usa blue/indigo/violet como accent. Lumenva diverge não trocando de hue, mas removendo o accent cromático por completo.
- **Funcional em monitores 8h/dia** — contraste calibrado, nunca preto absoluto em grandes áreas (regra 4 da spec de identidade).

A paleta tem **dois temas desenhados independentemente**, não invertidos.

## Light theme — accent (escala de cinza)

Marca não tem accent cromático — o "accent" funcional é a própria escala de cinza da marca, com o preto (`#111111`) como accent canônico direto, fora da escala numerada.

| Stop | Hex | Uso prescrito |
|------|-----|---------------|
| 50 | `#fafafa` | Background de hover muito sutil, soft chip background |
| 100 | `#f5f5f7` | `--ds-accent-soft` — bg de badge accent, hover de nav-link |
| 200 | `#e8e8ed` | Borders de elementos accent secundários |
| 300 | `#d2d2d7` | Disabled state, decorative dividers |
| 400 | `#aeaeb2` | Hover de elementos accent claros |
| 500 | `#8e8e93` | Meio da escala — raramente usado como fg |
| 600 | `#6e6e73` | `--ds-text-muted` (Lumenva Gray) |
| 700 | `#48484a` | Texto secundário forte |
| 800 | `#3a3a3c` | Texto quase-primary |
| 900 | `#2c2c2e` | — |
| 950 | `#1c1c1e` | — (uso extremo) |
| **accent canônico** | `#111111` | **Lumenva Black** — botão primary bg, link, focus ring color, foco (fora da escala numerada, é a cor de marca) |

## Light theme — neutral (Lumenva gray)

| Stop | Hex | Uso prescrito |
|------|-----|---------------|
| 50 | `#fafafa` | `--ds-surface-elevated` — alt-bg, header, dropdown bg |
| 100 | `#f5f5f7` | `--ds-bg` — page background |
| 200 | `#e8e8ed` | `--ds-border` — borders default |
| 300 | `#d2d2d7` | Borders mais firmes, divider de tabela |
| 400 | `#aeaeb2` | Placeholder text, ícone disabled |
| 500 | `#8e8e93` | Texto utilitário (timestamp, helper) |
| 600 | `#6e6e73` | `--ds-text-muted` — texto secundário, label |
| 700 | `#48484a` | Texto importante mas não primary |
| 800 | `#3a3a3c` | Heading secundário |
| 900 | `#2c2c2e` | — (raro em light) |
| 950 | `#1c1c1e` | — (raro em light) |
| **texto primário** | `#111111` | `--ds-text` — Lumenva Black, texto primary (corpo, headings), fora da escala numerada |

**Surfaces light:**
- `bg`: `#f5f5f7` — página
- `surface`: `#ffffff` — cards e superfícies elevadas (branco puro)
- `surfaceElevated`: `#fafafa` — alt-bg, header, dropdown bg
- `text`: `#111111` / `textMuted`: `#6e6e73` / `border`: `#e8e8ed`

## Dark theme — accent (escala de cinza, ajustado)

| Stop | Hex | Uso prescrito |
|------|-----|---------------|
| 50 | `#fafafa` | **Brand accent em dark** — primary button bg, link, focus (Lumenva White) |
| 100 | `#f5f5f7` | Hover state em link |
| 200 | `#e8e8ed` | Hover mais discreto |
| 300 | `#d2d2d7` | Border accent em dark |
| 400 | `#aeaeb2` | Soft accent bg (badges) |
| 500 | `#8e8e93` | — |
| 600 | `#6e6e73` | — |
| 700 | `#48484a` | — |
| 800 | `#3a3a3c` | Background quase invisível (decorativo) |
| 900 | `#2c2c2e` | — |
| 950 | `#1c1c1e` | — |

> **Nota:** em dark, o "primary" sobe pro branco (`#f5f5f7`) pra preservar contraste sobre fundos escuros — espelha o comportamento do light (onde o primary é o preto).

## Dark theme — neutral (Lumenva gray)

| Stop | Hex | Uso prescrito |
|------|-----|---------------|
| 50 | `#f5f5f7` | `--ds-text` — texto primary em dark |
| 100 | `#e8e8ed` | Texto sobre surface escuro (alta hierarquia) |
| 200 | `#aeaeb2` | Texto importante em dark, `--ds-text-muted` |
| 300 | `#8e8e93` | Placeholder, helper |
| 400 | `#6e6e73` | Disabled |
| 500 | `#48484a` | — |
| 600 | `#3a3a3c` | `--ds-border` — borders default |
| 700 | `#2c2c2e` | `--ds-surface-elevated` — header, dropdown |
| 800 | `#1c1c1e` | `--ds-surface` — cards |
| 900 | `#111111` | `--ds-bg` — page background |
| 950 | `#111111` | — (mesmo tom, sem preto mais escuro fora da paleta aprovada) |

**Surfaces dark:**
- `bg`: `#111111` — página (Lumenva Black)
- `surface`: `#1c1c1e` — cards
- `surfaceElevated`: `#2c2c2e` — header, dropdown
- `text`: `#f5f5f7` / `textMuted`: `#aeaeb2` / `border`: `#3a3a3c`

## Estados (success / warning / error / info)

`info` não recebe hue própria — usar uma 4ª família cromática (azul) além do vermelho/verde/âmbar já é o limite aceito pela spec de identidade. `info` usa o cinza mais escuro do texto (`#48484a` light / `#aeaeb2` dark).

| Estado | Light | Dark | Uso |
|--------|-------|------|-----|
| `success` | `#2e7d46` | `#5fb37a` | Confirmação positiva, status "ativo", "lido" |
| `warning` | `#a9660b` | `#e0973b` | Atenção sem urgência, SLA próximo de vencer |
| `error` | `#b3261e` | `#ff6259` | Erro, ação destrutiva, SLA estourado |
| `info` | `#48484a` | `#aeaeb2` | Mensagem informativa, dica — cinza, não hue própria |

**Regra não negociável (spec de identidade §6 e §9.10):** cor nunca é o único canal. Todo estado semântico é sempre ícone + texto + cor, nunca cor isolada.

**Como aplicar estados (3 padrões):**

```css
/* 1. Como bg de badge: estado a 14% transparência + estado como fg */
.badge-success {
  background: color-mix(in srgb, var(--ds-success) 14%, transparent);
  color: var(--ds-success);
}

/* 2. Como border (foco específico): full opacity */
.input-error { border-color: var(--ds-error); }

/* 3. Como bg de botão destrutivo: full opacity, fg branco */
.btn-destructive { background: var(--ds-error); color: #fff; }
```

## Contraste WCAG

| Combinação | Ratio | Nível | OK pra |
|------------|-------|-------|--------|
| `text` (`#111111`) sobre `bg` (`#f5f5f7`) | ~18.1:1 | AAA | Prosa longa, body text |
| `text-muted` (`#6e6e73`) sobre `bg` | ~4.9:1 | AA | Secondary, helper, timestamps |
| accent canônico (`#111111`) sobre `bg` | ~18.1:1 | AAA | Botão primary, texto UI |
| Dark: `text` (`#f5f5f7`) sobre `bg` (`#111111`) | ~17.9:1 | AAA | Body text |
| Dark: accent canônico (`#f5f5f7`) sobre `bg` | ~17.9:1 | AAA | Link, primary |
| `error` light (`#b3261e`) sobre `bg` | ~6.0:1 | AA+ | UI text 14px+ |

**Regras:**
- Body text e prosa: AAA mínimo (`text` + `bg`).
- UI text 14px+: AA mínimo (4.5:1).
- Componentes não-textuais (borders, ícones): AA UI mínimo (3:1).
- Nunca usar `text-muted` para texto em prosa longa (apenas labels, helpers, timestamps).

## Anti-padrões — como NÃO usar Lumenva

❌ **Introduzir qualquer 4ª família cromática.** `info` é cinza, não azul. Gráficos categóricos que precisem de mais séries abrem RFC — não inventam hue nova aqui.

❌ **Preto absoluto em grandes áreas.** Regra 4 da spec de identidade: `#111111` cria contraste e foco, não é fundo de página inteira em light.

❌ **Branco puro (`#ffffff`) como fundo de página.** `#ffffff` é reservado a `surface` (cards elevados); o fundo de página é `#f5f5f7`.

❌ **Accent como bg de toda a sidebar.** Sidebar é `surface`/`surface-elevated`. Accent (preto/branco) aparece como hover-state, active-state, botão primary — não como fundo de área grande.

❌ **Estado semântico só por cor.** Todo badge/alerta/status leva ícone Phosphor + texto, cor é reforço.

❌ **Gradients accent → accent.** Lumenva não usa gradients; use solid + shadow discreta se precisar de profundidade.

## Acessibilidade (visão de cor)

Uma paleta monocromática com hierarquia por luminosidade (não por hue) é inerentemente mais segura para daltonismo do que qualquer paleta de accent colorido — não há diferenciação verde-vermelho a preservar no accent, porque não existe accent colorido. Os únicos hues do sistema (`success`/`warning`/`error`) seguem a convenção universal (verde/âmbar/vermelho) e **nunca são o único canal**: ícone Phosphor + cor + label de texto sempre acompanham. Ex.: badge de SLA estourado tem cor `error`, ícone `Warning`, e texto "Vencido há 2h".
```

- [ ] **Step 2: Delete the old file**

```bash
git rm docs/design-system/02-palette-sage.md
```

- [ ] **Step 3: Commit**

```bash
git add docs/design-system/02-palette-lumenva.md
git commit -m "docs(design-system): rename and rewrite palette doc for Lumenva (was Sage)"
```

---

### Task 8: `docs/design-system/03-typography.md` — system-ui replaces Atkinson

**Files:**
- Modify: `docs/design-system/03-typography.md:3`
- Modify: `docs/design-system/03-typography.md:5-27`
- Modify: `docs/design-system/03-typography.md:29`
- Modify: `docs/design-system/03-typography.md:119`
- Modify: `docs/design-system/03-typography.md:136`

**Interfaces:** None (documentation only).

- [ ] **Step 1: Update the source-of-truth line**

At `docs/design-system/03-typography.md:3`, replace:

```markdown
> **Source of truth:** `app/design/lib/fonts.ts` (`atkinson`, `plexMono`), `app/design/lib/tokens.ts` → `TYPOS.atkinson`
```

with:

```markdown
> **Source of truth:** `app/globals.css` (font-family), `app/design/lib/tokens.ts` → `TYPOS["system-ui"]`
```

- [ ] **Step 2: Replace the "Por que Atkinson" section through the stack block**

At `docs/design-system/03-typography.md:5-27`, replace:

```markdown
## Por que Atkinson Hyperlegible

A fonte de display + body do DeskcommCRM é **Atkinson Hyperlegible**, criada pelo Braille Institute em 2020 com um único objetivo: **maximizar a distinção entre caracteres similares** para usuários com baixa visão.

Razões da escolha:

- **Acessibilidade-first.** `0` vs `O`, `1` vs `l` vs `I`, `rn` vs `m`, `B` vs `8` — todos disambiguados por design. Crítico em CRM onde número de pedido (`#01430`) e código de cliente (`Bl0OO1`) precisam ser lidos sem ambiguidade.
- **Humanista, não geométrica.** Curvas levemente abertas, terminais não-mecânicos. Diferencia do par Inter/Geist (geométrico, dominante no SaaS atual).
- **Baseline alta, x-height generosa.** Confortável em 12–13px, que é onde acontece 80% da UI operacional (timestamps, helpers, dados de tabela).
- **Anti-genérica.** Quase ninguém em CRM SaaS usa Atkinson. Diverge sem custo de legibilidade — pelo contrário, ganha.
- **Mesma família display + body.** Reduz cognição na hierarquia: o que muda é peso e tamanho, não tipo. Combina com Aerada (a hierarquia vem do whitespace).

A fonte secundária para **dados monoespaçados** é **IBM Plex Mono** — escolhida por ter a mesma sensibilidade humanista (pertence à família Plex, da IBM) sem cair em JetBrains Mono (saturação developer-tools) nem Fira Code (ligatures que confundem em UI).

## Stack completo

```css
--ds-font-display: var(--font-atkinson), ui-sans-serif, system-ui, sans-serif;
--ds-font-body:    var(--font-atkinson), ui-sans-serif, system-ui, sans-serif;
--ds-font-mono:    var(--font-plex-mono), ui-monospace, "SF Mono", Menlo, monospace;
```

`var(--font-atkinson)` é injetado por `next/font/google` via `app/design/lib/fonts.ts`.
```

with:

```markdown
## Por que System UI

A fonte de display + body do Lumenva CRM é a **stack de fonte nativa do sistema operacional** (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`), decisão registrada em `docs/superpowers/specs/2026-08-11-lumenva-crm-fundacao-visual-design.md`.

Razões da escolha:

- **Zero custo de carregamento.** Nenhum request de font externo — resolve o filtro "reduz fadiga, acelera leitura" sem depender de rede, relevante para instalações self-host em VPS de latência variável.
- **Renderização nativa por SO.** O produto é self-host e roda em qualquer sistema operacional do usuário final — Mac renderiza SF real, Windows renderiza Segoe UI, Linux cai no sans-serif do ambiente. Não força uma fonte importada por cima da preferência de renderização nativa do SO.
- **Coerente com a direção Apple-inspired.** Em Mac (onde a referência visual foi desenhada), a fonte resultante É a família do sistema Apple — sem imitação.
- **Mesma família display + body.** Reduz cognição na hierarquia: o que muda é peso e tamanho, não tipo. Combina com Aerada (a hierarquia vem do whitespace).

A fonte secundária para **dados monoespaçados** continua **IBM Plex Mono** — inalterada por esta migração (fora do escopo da spec de identidade visual).

## Stack completo

```css
--ds-font-display: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--ds-font-body:    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--ds-font-mono:    var(--font-plex-mono), ui-monospace, "SF Mono", Menlo, monospace;
```

A stack de display/body não passa por `next/font` — é resolvida pelo navegador/SO diretamente, sem variável CSS injetada.
```

- [ ] **Step 3: Update the weights note**

At `docs/design-system/03-typography.md:29`, replace:

```markdown
**Pesos disponíveis** (Atkinson):
```

with:

```markdown
**Pesos disponíveis** (System UI):
```

- [ ] **Step 4: Update the tabular-nums example line**

At `docs/design-system/03-typography.md:119`, replace:

```markdown
- ID `#12.443` está em sans (Atkinson) com `font-variant-numeric: tabular-nums` porque é um número curto inline; quando vira coluna de tabela, vira `mono-data` (Plex Mono).
```

with:

```markdown
- ID `#12.443` está em sans (System UI) com `font-variant-numeric: tabular-nums` porque é um número curto inline; quando vira coluna de tabela, vira `mono-data` (Plex Mono).
```

- [ ] **Step 5: Update the minimum-weight note**

At `docs/design-system/03-typography.md:136`, replace:

```markdown
- **Peso mínimo de leitura:** 400 sempre. Light (300) não existe na escala — Atkinson não tem 300 carregado.
```

with:

```markdown
- **Peso mínimo de leitura:** 400 sempre. Light (300) não faz parte da escala — a fonte de sistema varia peso disponível por SO, e a escala do produto não depende de um 300 garantido.
```

- [ ] **Step 6: Grep for any remaining "Atkinson" mentions**

Run: `grep -n -i atkinson docs/design-system/03-typography.md`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add docs/design-system/03-typography.md
git commit -m "docs(design-system): update typography doc for system-ui font stack"
```

---

### Task 9: Full verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 2: Full lint**

Run: `pnpm lint`
Expected: 0 errors/warnings.

- [ ] **Step 3: Grep for any remaining Sage/Atkinson reference outside of git history and unrelated files**

Run: `grep -rln "sage\|Sage\|atkinson\|Atkinson" app/ docs/design-system/ tailwind.config.ts --include=*.ts --include=*.tsx --include=*.css --include=*.md 2>/dev/null`
Expected: no match. If a match appears in a file not touched by Tasks 1-8, evaluate whether it's in scope (a component hardcoding `bg-accent-500` expecting green is NOT in scope for this plan — flag it, don't fix it here) or a genuine miss from this plan's file list (fix it).

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: build succeeds (confirms no broken import from the removed `atkinson` export or `PALETTES.sage` reference anywhere in the app, including routes not exercised by typecheck's narrower scope in some configs).

- [ ] **Step 5: Visual contrast check (Playwright)**

Use `playwright-cli` to open the running app (`pnpm dev` or the `pnpm build && pnpm start` output) at a screen with visible text, and run in the page context:

```js
function contrastRatio(hex1, hex2) {
  const lum = (hex) => {
    const c = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const l1 = lum(hex1) + 0.05, l2 = lum(hex2) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}
contrastRatio("#111111", "#f5f5f7"); // expect ~18.1
```

Expected: ratio matches the value documented in `docs/design-system/02-palette-lumenva.md` (~18.1:1) within rounding. Repeat with `data-theme="dark"` set on `<html>` for the dark pair (`#f5f5f7` on `#111111`, same ratio by symmetry).

- [ ] **Step 6: Report**

No commit for this task (verification only). Summarize in the session: typecheck/lint/build status, contrast measurements, and any out-of-scope Sage/Atkinson references found in Step 3 that should be flagged to the user rather than fixed here.
