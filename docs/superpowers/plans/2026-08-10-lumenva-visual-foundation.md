# Lumenva Visual Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar ao CRM a fundação visual aprovada da Lumenva — monocromática, clara, premium, confortável e consistente — sem alterar fluxos de negócio.

**Architecture:** Consolidar a identidade visual numa única paleta Lumenva e expô-la através dos tokens já existentes (`app/design/lib/tokens.ts` → CSS variables → Tailwind/shadcn aliases). O tema claro é a referência principal; o dark mode continua suportado como variante premium. A migração preserva a API semântica dos componentes sempre que possível para reduzir regressões e elimina a escolha de paletas antigas do showcase.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Tailwind CSS 3.4, shadcn/Radix, Vitest 4, Testing Library, Playwright/axe-core.

## Global Constraints

- Existe uma única marca: Lumenva.
- A marca utiliza apenas preto, cinzento e branco.
- Cores principais aprovadas: `#111111`, `#6E6E73`, `#F5F5F7`.
- A experiência clara é a referência principal; aproximadamente 70–80% das grandes áreas devem ser claras.
- Grandes áreas em preto absoluto devem ser evitadas.
- O dark mode é alternativa premium, não identidade dominante.
- Cor nunca pode ser o único meio de comunicar estado ou significado.
- Sem neon, cyberpunk, cores saturadas ou efeitos “AI genéricos”.
- Sem nova dependência de runtime para esta migração.
- Preservar os contratos Tailwind/shadcn existentes para não provocar refactor transversal desnecessário.
- Tipografia final fica fora deste plano; a fonte actual é preservada até existir decisão específica aprovada.

---

## File Structure

**Modificar**
- `app/design/lib/tokens.ts` — fonte TypeScript da paleta, superfícies, estados e derivados.
- `app/design/lib/variant-context.tsx` — aplicar uma única paleta e manter apenas tema/tipografia/densidade como variantes.
- `app/design/components/Switcher.tsx` — remover selector de paleta.
- `app/design/sections/SectionPalettes.tsx` — transformar a página de comparação em documentação da paleta Lumenva.
- `app/design/page.tsx` — trocar referências DeskcommCRM/paletas por Lumenva e remover instruções obsoletas.
- `app/globals.css` — CSS variables light/dark, estados semânticos, sombras e aliases shadcn.
- `tailwind.config.ts` — comentários e aliases coerentes com a paleta monocromática.
- `app/layout.tsx` — actualizar `themeColor` e remover `richColors` do Sonner.
- `docs/design-system/01-foundation-tokens.md` — remover linguagem warm/greige e documentar neutralidade Lumenva.
- `docs/brand/README.md` — alinhar materiais de marca à nova paleta.

**Criar**
- `app/design/lib/tokens.test.ts` — invariantes da paleta e superfícies.
- `app/design/components/Switcher.test.tsx` — garantia de que não existe selector de paleta.
- `docs/design-system/02-color-system.md` — contrato cromático oficial do produto.

---

### Task 1: Fixar a paleta Lumenva como contrato testável

**Files:**
- Create: `app/design/lib/tokens.test.ts`
- Modify: `app/design/lib/tokens.ts`

**Interfaces:**
- Produces: `PALETTES.lumenva`, `PaletteId = "lumenva"`, escalas `neutralLight`, `neutralDark`, `states`, `surfaces`.
- Consumes: tipos `ColorScale`, `StateColors`, `PaletteDef` já existentes.

- [ ] **Step 1: Escrever os testes que fixam as três cores de marca**

Criar `app/design/lib/tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PALETTES } from "./tokens";

describe("Lumenva visual foundation", () => {
  const palette = PALETTES.lumenva;

  it("uses the approved brand anchors", () => {
    expect(palette.surfaces.light.bg).toBe("#F5F5F7");
    expect(palette.surfaces.light.text).toBe("#111111");
    expect(palette.surfaces.light.textMuted).toBe("#6E6E73");
  });

  it("contains only neutral RGB colours in the brand scales", () => {
    const values = [
      ...Object.values(palette.accent),
      ...Object.values(palette.neutralLight),
      ...Object.values(palette.neutralDark),
      ...Object.values(palette.states.light),
      ...Object.values(palette.states.dark),
    ];

    for (const hex of values) {
      const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
      expect(match, hex).not.toBeNull();
      const [, r, g, b] = match!;
      expect(r.toLowerCase(), hex).toBe(g.toLowerCase());
      expect(g.toLowerCase(), hex).toBe(b.toLowerCase());
    }
  });

  it("keeps light surfaces lighter than dark surfaces", () => {
    expect(palette.surfaces.light.bg).toBe("#F5F5F7");
    expect(palette.surfaces.light.surface).toBe("#FFFFFF");
    expect(palette.surfaces.dark.bg).toBe("#111111");
    expect(palette.surfaces.dark.surface).toBe("#1C1C1E");
  });
});
```

- [ ] **Step 2: Executar o teste para confirmar a falha inicial**

Run:

```bash
pnpm vitest run app/design/lib/tokens.test.ts
```

Expected: FAIL porque `PALETTES.lumenva` ainda não existe.

- [ ] **Step 3: Substituir as cinco paletas antigas por uma única paleta Lumenva**

Em `app/design/lib/tokens.ts`, alterar:

```ts
export type PaletteId = "lumenva";
```

Manter os tipos existentes e substituir `PALETTES` por uma única entrada:

```ts
export const PALETTES: Record<PaletteId, PaletteDef> = {
  lumenva: {
    id: "lumenva",
    name: "Lumenva",
    description: "Monocromática, premium, confortável e profissional.",
    accent: {
      50: "#FAFAFA",
      100: "#F5F5F7",
      200: "#E8E8ED",
      300: "#D2D2D7",
      400: "#AEAEB2",
      500: "#8E8E93",
      600: "#6E6E73",
      700: "#48484A",
      800: "#3A3A3C",
      900: "#1C1C1E",
      950: "#111111",
    },
    neutralLight: {
      50: "#FFFFFF",
      100: "#F5F5F7",
      200: "#E8E8ED",
      300: "#D2D2D7",
      400: "#AEAEB2",
      500: "#8E8E93",
      600: "#6E6E73",
      700: "#48484A",
      800: "#3A3A3C",
      900: "#1C1C1E",
      950: "#111111",
    },
    neutralDark: {
      50: "#F5F5F7",
      100: "#E8E8ED",
      200: "#D2D2D7",
      300: "#AEAEB2",
      400: "#8E8E93",
      500: "#6E6E73",
      600: "#48484A",
      700: "#3A3A3C",
      800: "#2C2C2E",
      900: "#1C1C1E",
      950: "#111111",
    },
    states: {
      light: {
        success: "#3A3A3C",
        warning: "#6E6E73",
        error: "#111111",
        info: "#48484A",
      },
      dark: {
        success: "#D2D2D7",
        warning: "#AEAEB2",
        error: "#F5F5F7",
        info: "#E8E8ED",
      },
    },
    surfaces: {
      light: {
        bg: "#F5F5F7",
        surface: "#FFFFFF",
        surfaceElevated: "#FAFAFA",
        text: "#111111",
        textMuted: "#6E6E73",
        border: "#E8E8ED",
      },
      dark: {
        bg: "#111111",
        surface: "#1C1C1E",
        surfaceElevated: "#2C2C2E",
        text: "#F5F5F7",
        textMuted: "#AEAEB2",
        border: "#3A3A3C",
      },
    },
  },
};
```

- [ ] **Step 4: Executar os testes da fundação**

```bash
pnpm vitest run app/design/lib/tokens.test.ts
```

Expected: PASS.

- [ ] **Step 5: Executar typecheck para localizar consumers das paletas removidas**

```bash
pnpm typecheck
```

Expected nesta etapa: podem existir erros em `variant-context.tsx`, `Switcher.tsx` ou showcase que ainda referenciam IDs antigos; registar exactamente esses erros para a Task 2, sem fazer refactors fora do âmbito.

- [ ] **Step 6: Commit**

```bash
git add app/design/lib/tokens.ts app/design/lib/tokens.test.ts
git commit -m "feat(design): define Lumenva monochrome palette"
```

---

### Task 2: Remover a escolha de paleta e manter apenas uma identidade

**Files:**
- Modify: `app/design/lib/variant-context.tsx`
- Modify: `app/design/components/Switcher.tsx`
- Create: `app/design/components/Switcher.test.tsx`

**Interfaces:**
- Produces: contexto com `typo`, `density`, `theme`; paleta Lumenva aplicada internamente.
- Preserves: `setTypo`, `setDensity`, `setTheme`.

- [ ] **Step 1: Escrever o teste do Switcher sem selector de paleta**

```tsx
import { render, screen } from "@testing-library/react";
import { VariantProvider } from "../lib/variant-context";
import { Switcher } from "./Switcher";

describe("Switcher", () => {
  it("does not offer multiple brand palettes", () => {
    render(
      <VariantProvider>
        <Switcher />
      </VariantProvider>,
    );

    expect(screen.queryByLabelText("Paleta")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tipografia")).toBeInTheDocument();
    expect(screen.getByLabelText("Densidade")).toBeInTheDocument();
    expect(screen.getByLabelText("Alternar tema")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Confirmar a falha**

```bash
pnpm vitest run app/design/components/Switcher.test.tsx
```

Expected: FAIL porque o selector `Paleta` ainda existe.

- [ ] **Step 3: Simplificar `variant-context.tsx`**

Remover `palette` e `setPalette` de `State`/`Ctx`; usar sempre:

```ts
const palette = PALETTES.lumenva;
```

`applyToRoot()` deve receber apenas `{ typo, density, theme }` e definir:

```ts
root.dataset.palette = "lumenva";
```

Estado inicial:

```ts
const [state, setState] = React.useState<State>({
  typo: "bricolage-jakarta",
  density: "equilibrada",
  theme: "light",
});
```

Na leitura de `localStorage`, aceitar apenas `typo`, `density` e `theme`; ignorar o campo legado `palette` para que instalações existentes migrem silenciosamente.

- [ ] **Step 4: Remover selector de paleta do `Switcher.tsx`**

Remover imports `PALETTES`, `PaletteId` e o primeiro `<select aria-label="Paleta">`.

- [ ] **Step 5: Executar teste e typecheck**

```bash
pnpm vitest run app/design/components/Switcher.test.tsx
pnpm typecheck
```

Expected: PASS; o typecheck pode ainda apontar `app/design/page.tsx` e `SectionPalettes.tsx`, que serão tratados na Task 4.

- [ ] **Step 6: Commit**

```bash
git add app/design/lib/variant-context.tsx app/design/components/Switcher.tsx app/design/components/Switcher.test.tsx
git commit -m "refactor(design): lock showcase to Lumenva palette"
```

---

### Task 3: Alinhar CSS global, Tailwind, dark mode e feedback do sistema

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: cores e superfícies definidas na Task 1.
- Preserves: nomes `--color-*`, aliases shadcn e classes Tailwind existentes.

- [ ] **Step 1: Actualizar `:root` em `app/globals.css`**

Usar exactamente:

```css
--color-bg: #F5F5F7;
--color-surface: #FFFFFF;
--color-surface-elevated: #FAFAFA;
--color-overlay: rgba(17, 17, 17, 0.36);

--color-text: #111111;
--color-text-muted: #6E6E73;
--color-text-subtle: #8E8E93;

--color-border: #E8E8ED;
--color-border-strong: #D2D2D7;
```

Mapear `--color-accent-*` e `--color-neutral-*` para a mesma escala monocromática da Task 1. Definir o CTA principal como:

```css
--color-accent: #111111;
--color-accent-fg: #F5F5F7;
--color-accent-soft: #E8E8ED;
--color-accent-hover: #1C1C1E;
```

- [ ] **Step 2: Tornar os estados semânticos monocromáticos**

Light:

```css
--color-success: #3A3A3C;
--color-success-bg: #F5F5F7;
--color-success-fg: #1C1C1E;
--color-warning: #6E6E73;
--color-warning-bg: #F5F5F7;
--color-warning-fg: #3A3A3C;
--color-error: #111111;
--color-error-bg: #E8E8ED;
--color-error-fg: #111111;
--color-info: #48484A;
--color-info-bg: #F5F5F7;
--color-info-fg: #1C1C1E;
```

Dark deve usar apenas `#F5F5F7`, `#E8E8ED`, `#D2D2D7`, `#AEAEB2`, `#6E6E73`, `#48484A`, `#3A3A3C`, `#2C2C2E`, `#1C1C1E`, `#111111`.

- [ ] **Step 3: Ajustar sombras para neutralidade e conforto**

Light:

```css
--shadow-xs: 0 1px 2px rgba(17, 17, 17, 0.03);
--shadow-sm: 0 1px 3px rgba(17, 17, 17, 0.04);
--shadow-md: 0 6px 18px -6px rgba(17, 17, 17, 0.10);
--shadow-lg: 0 16px 40px -12px rgba(17, 17, 17, 0.14);
--shadow-xl: 0 28px 64px -18px rgba(17, 17, 17, 0.18);
```

Dark pode usar preto com alfa apenas como efeito físico de elevação, nunca como nova cor de marca.

- [ ] **Step 4: Actualizar `[data-theme="dark"]`**

Definir:

```css
--color-bg: #111111;
--color-surface: #1C1C1E;
--color-surface-elevated: #2C2C2E;
--color-text: #F5F5F7;
--color-text-muted: #AEAEB2;
--color-text-subtle: #8E8E93;
--color-border: #3A3A3C;
--color-border-strong: #48484A;
--color-accent: #F5F5F7;
--color-accent-fg: #111111;
--color-accent-soft: #2C2C2E;
--color-accent-hover: #E8E8ED;
```

- [ ] **Step 5: Alinhar `tailwind.config.ts` sem quebrar consumers**

Manter todas as keys (`accent`, `success`, `warning`, `error`, `info`, `destructive`) para compatibilidade, mas trocar comentários “Sage”/“greige” por “Lumenva monochrome”. Alterar:

```ts
ring: "var(--color-border-strong)",
```

E:

```ts
destructive: {
  DEFAULT: "var(--color-error)",
  foreground: "var(--color-accent-fg)",
},
```

- [ ] **Step 6: Actualizar `app/layout.tsx`**

Trocar viewport:

```ts
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F7" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};
```

Remover `richColors` de `<Toaster>` para impedir que Sonner reintroduza verde/vermelho automaticamente:

```tsx
<Toaster position="top-right" closeButton duration={4000} />
```

- [ ] **Step 7: Verificar build estático**

```bash
pnpm typecheck
pnpm lint app/globals.css tailwind.config.ts app/layout.tsx
```

Se o comando de lint não aceitar CSS como target, usar:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css tailwind.config.ts app/layout.tsx
git commit -m "feat(design): apply Lumenva visual foundation globally"
```

---

### Task 4: Transformar o showcase em fonte de verdade da Lumenva

**Files:**
- Modify: `app/design/page.tsx`
- Modify: `app/design/sections/SectionPalettes.tsx`

**Interfaces:**
- Consumes: `PALETTES.lumenva`.
- Produces: showcase sem variantes de marca e com previews light/dark da identidade oficial.

- [ ] **Step 1: Actualizar branding do showcase**

Em `app/design/page.tsx`:

- trocar `DeskcommCRM` por `Lumenva`;
- remover import de `PALETTES`;
- remover a linha “Paleta · …” do painel “SELECIONADO”;
- alterar o texto do banner para explicar que a identidade é fixa e apenas tipografia/densidade/tema são exploráveis.

Texto recomendado:

```tsx
<h1>Design System — Lumenva</h1>
<p>
  A identidade cromática é fixa. Use o switcher apenas para validar
  <strong> tipografia · densidade · tema</strong> enquanto as decisões em aberto são fechadas.
</p>
```

- [ ] **Step 2: Simplificar `SectionPalettes.tsx` para uma única paleta**

Eliminar `useVariant`, `PaletteId`, loop `Object.values(PALETTES)` e botão “Aplicar paleta”. Usar:

```ts
const palette = PALETTES.lumenva;
```

Título:

```tsx
<h2 className="ds-display">Cor</h2>
<p className="ds-lede">
  A Lumenva utiliza uma única família monocromática. Preto, cinzento e branco
  criam hierarquia por luminosidade, espaço, peso e elevação — nunca por saturação.
</p>
```

Manter swatches neutralLight/neutralDark, previews light/dark e uma secção de estados que mostre também um rótulo textual explícito para cada estado.

- [ ] **Step 3: Garantir que nenhum texto obsoleto permanece**

```bash
grep -RInE "Sage|Clay|Mist|Plum|Olive|greige|soft-tech" app/design docs/design-system app/globals.css
```

Expected: zero ocorrências relevantes após a Task 5; nesta etapa podem restar apenas documentos ainda por actualizar.

- [ ] **Step 4: Executar typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/design/page.tsx app/design/sections/SectionPalettes.tsx
git commit -m "refactor(design): make Lumenva palette canonical in showcase"
```

---

### Task 5: Actualizar a documentação de tokens e marca

**Files:**
- Modify: `docs/design-system/01-foundation-tokens.md`
- Create: `docs/design-system/02-color-system.md`
- Modify: `docs/brand/README.md`

**Interfaces:**
- Documents: contrato visual que futuros PRs devem obedecer.

- [ ] **Step 1: Corrigir `01-foundation-tokens.md`**

Substituir qualquer regra de “greige/warm” por neutralidade Lumenva. Na secção Shadow, usar:

```md
Sombras derivam do Lumenva Black (`#111111`) apenas com baixa opacidade.
A sombra serve para hierarquia física; nunca introduz uma nova família cromática.
```

Manter spacing/radius/motion existentes neste plano; não redesenhar escalas fora do âmbito.

- [ ] **Step 2: Criar `02-color-system.md`**

Conteúdo mínimo obrigatório:

```md
# 02 — Lumenva Color System

## Brand anchors
- Lumenva Black — `#111111`
- Lumenva Gray — `#6E6E73`
- Lumenva White — `#F5F5F7`

## Light reference
- App background — `#F5F5F7`
- Surface — `#FFFFFF`
- Elevated surface — `#FAFAFA`
- Primary text — `#111111`
- Secondary text — `#6E6E73`
- Border — `#E8E8ED`
- Strong border — `#D2D2D7`

## Dark reference
- App background — `#111111`
- Surface — `#1C1C1E`
- Elevated surface — `#2C2C2E`
- Primary text — `#F5F5F7`
- Secondary text — `#AEAEB2`
- Border — `#3A3A3C`

## Rules
1. Não introduzir hue cromático em UI de produto.
2. Cor não comunica estado sozinha: usar ícone + texto + forma/posição.
3. Tema claro é a referência principal.
4. Branco puro é superfície elevada, não fundo global.
5. Preto absoluto `#000000` não é cor de marca.
6. Valores literais de cor em feature são proibidos; usar tokens.
```

- [ ] **Step 3: Actualizar `docs/brand/README.md`**

Trocar a regra antiga de creme/sage por:

```md
- Paleta oficial: Lumenva Black `#111111`, Lumenva Gray `#6E6E73`, Lumenva White `#F5F5F7`.
- Materiais externos podem usar profundidade, blur, luz e gradientes neutros, mas não podem introduzir novas famílias cromáticas.
- O produto deve parecer claro, confortável e premium; a comunicação externa pode ser mais dramática sem deixar de ser monocromática.
```

Não declarar tipografia como final neste documento enquanto a decisão ainda estiver aberta.

- [ ] **Step 4: Scan de doutrina antiga**

```bash
grep -RInE "Sage|Clay|Mist|Plum|Olive|greige|terracota|verde-erva|azul-poeira|ameixa|verde-oliva" app/design app/globals.css docs/design-system docs/brand
```

Expected: zero resultados que descrevam a identidade actual.

- [ ] **Step 5: Commit**

```bash
git add docs/design-system/01-foundation-tokens.md docs/design-system/02-color-system.md docs/brand/README.md
git commit -m "docs(design): document Lumenva monochrome color system"
```

---

### Task 6: Gates finais de regressão, acessibilidade e consistência

**Files:**
- Modify only if a failing gate exposes a defect in files touched by Tasks 1–5.

**Interfaces:**
- Verifies: design tokens, type safety, lint, unit suite and accessibility baseline.

- [ ] **Step 1: Executar os testes específicos**

```bash
pnpm vitest run app/design/lib/tokens.test.ts app/design/components/Switcher.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Executar gates de código**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
```

Expected: PASS em todos.

- [ ] **Step 3: Verificar ausência de hues nas fontes de identidade**

Executar:

```bash
node - <<'NODE'
const fs = require('fs');
const files = ['app/design/lib/tokens.ts', 'app/globals.css'];
const hex = /#[0-9a-fA-F]{6}/g;
const allow = new Set([
  '#FFFFFF','#FAFAFA','#F5F5F7','#E8E8ED','#D2D2D7','#AEAEB2','#8E8E93',
  '#6E6E73','#48484A','#3A3A3C','#2C2C2E','#1C1C1E','#111111'
].map(v => v.toUpperCase()));
let bad = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const value of text.match(hex) || []) {
    if (!allow.has(value.toUpperCase())) bad.push(`${file}: ${value}`);
  }
}
if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}
console.log('OK: identity sources are monochrome');
NODE
```

Expected: `OK: identity sources are monochrome`.

- [ ] **Step 4: Validar o showcase manualmente em light e dark**

```bash
pnpm dev
```

Abrir `/design` e confirmar:

- fundo claro `#F5F5F7` com superfícies brancas;
- texto principal grafite/preto suave;
- nenhum selector de paleta;
- nenhum verde/azul/vermelho/âmbar em swatches, CTA ou estados;
- dark mode com `#111111` como fundo e sem preto absoluto dominante;
- foco visível por contraste/outline;
- estados acompanhados de texto explícito.

- [ ] **Step 5: Executar verificação de acessibilidade disponível**

Se já existir jornada Playwright para `/design`, usar a existente. Caso contrário, não criar uma suíte E2E nova só para esta migração; validar os contrastes principais no browser e manter `@axe-core/playwright` para a futura etapa de componentes.

- [ ] **Step 6: Executar gate de governança antes de considerar concluído**

```bash
pnpm gov:verify
```

Expected: PASS.

- [ ] **Step 7: Commit apenas se os gates exigiram correcções**

```bash
git add <ficheiros-corrigidos>
git commit -m "fix(design): close Lumenva visual foundation regressions"
```

Se nenhum ficheiro mudou, não criar commit vazio.

---

## Self-Review

- **Spec coverage:** marca única, três famílias cromáticas, anchors `#111111/#6E6E73/#F5F5F7`, experiência clara, dark mode secundário, estados não dependentes apenas de cor, documentação e gates estão cobertos.
- **Explicitly out of scope:** tipografia final, logo vectorial master, redesign individual de cada ecrã, novos componentes, website e assets sociais. Cada um exige decisão/plano próprio.
- **Placeholder scan:** não existem `TBD`, `TODO`, “similar à task anterior” ou passos sem comando/resultado esperado.
- **Type consistency:** `PaletteId` torna-se `"lumenva"`; o contexto deixa de expor `palette/setPalette`; `Switcher` e showcase são actualizados no mesmo plano.
- **Risk control:** os aliases semânticos Tailwind/shadcn são preservados para evitar uma migração transversal de classes numa única mudança visual.
