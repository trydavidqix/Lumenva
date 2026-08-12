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
