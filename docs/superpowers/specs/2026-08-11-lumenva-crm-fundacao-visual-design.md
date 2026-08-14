# Fundação Visual Lumenva CRM — Design

Data: 2026-08-11
Estado: Aprovado
Branch: `gpt-lumenva-crm-ui`
Âmbito: tokens de fundação (paleta, tipografia, radius, shadow, dark mode) para o redesign do CRM. Não cobre migração de módulos individuais — cada módulo tem plano próprio, sequenciado após esta fundação.

## 1. Contexto e reconciliação de doutrina

`docs/design-system/` v1.0 (2026-04-28, "locked", exige RFC para trocar) define paleta Sage (verde), tipografia Atkinson Hyperlegible, densidade Aerada, iconografia Phosphor duotone.

`docs/superpowers/specs/2026-08-10-lumenva-identidade-visual-design.md` (Aprovado, mais recente) e `docs/brand/references/crm/README.md` (escopo desta branch, mais específico) travam paleta preto/cinza/branco e proíbem Sage explicitamente.

Por `docs/documentation.md` (precedência: doc mais recente e mais específico corrige o mais antigo, sem manter duas verdades):

- **Paleta**: Sage é substituída por completo. Não é RFC — é correção de doutrina superada por decisão de produto já aprovada.
- **Tipografia**: Atkinson Hyperlegible é substituída por system font stack (decisão desta sessão, ver §3), já que a spec de identidade deixava tipografia em aberto ("elementos ainda por fechar").
- **Iconografia (Phosphor duotone) e densidade (Aerada)**: mantidas. Já eram monocromático-compatíveis e alinhadas a "muito espaço negativo" da spec nova; sem motivo para retrabalho.

Este documento fecha essa reconciliação para o âmbito de fundação visual. `docs/design-system/00-overview.md` e `README.md` devem ser atualizados na implementação (não apenas os tokens) para não deixar a v1.0 "locked" como fonte de verdade morta.

## 2. Paleta — tokens de fundação

Substitui `PALETTES.sage` por `PALETTES.lumenva` em `app/design/lib/tokens.ts`. Light é a referência principal (spec: 70-80% das grandes áreas claras). Dark recebe tokens completos nesta fundação, mas **sem toggle de UI nesta fase** — toggle/persistência entram no plano do módulo Shell.

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#F5F5F7` | `#111111` |
| `--color-surface` | `#FFFFFF` | `#1C1C1E` |
| `--color-surface-elevated` | `#FAFAFA` | `#2C2C2E` |
| `--color-text` | `#111111` | `#F5F5F7` |
| `--color-text-muted` | `#6E6E73` | `#AEAEB2` |
| `--color-text-subtle` | `#8E8E93` | `#8E8E93` |
| `--color-border` | `#E8E8ED` | `#3A3A3C` |
| `--color-border-strong` | `#D2D2D7` | `#48484A` |
| `--color-overlay` | `rgba(17,17,17,.42)` | `rgba(0,0,0,.6)` |

Escala completa de neutros derivados permitida pela marca (§ do doc de identidade): `#FFFFFF`, `#FAFAFA`, `#F5F5F7`, `#E8E8ED`, `#D2D2D7`, `#AEAEB2`, `#8E8E93`, `#6E6E73`, `#48484A`, `#3A3A3C`, `#2C2C2E`, `#1C1C1E`, `#111111`.

### 2.1 Estados semânticos (exceção controlada à monocromia)

Erro, sucesso e aviso mantêm acento de cor mínimo — vermelho, verde, âmbar — como tokens **funcionais**, não nova família de marca (a spec de identidade permite derivações técnicas para "resolver hierarquia, contraste e profundidade"; ações destrutivas sem vermelho são risco de UX real, não estético).

Regra não negociável: cor nunca é o único canal. Todo estado semântico é sempre ícone + texto + cor, nunca cor isolada.

| Token | Uso |
|---|---|
| `--color-danger` | erro, ação destrutiva |
| `--color-success` | sucesso, confirmação |
| `--color-warning` | aviso |

Valores exatos (contraste AA mínimo) ficam no plano de implementação, não fixados aqui — dependem de teste de contraste real contra `--color-bg`/`--color-surface`.

## 3. Tipografia

Troca `next/font` de Atkinson Hyperlegible para system font stack em `app/design/lib/fonts.ts`:

```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

Justificativa: zero custo de carregamento, renderização nativa por SO — relevante porque o produto é self-host e roda em qualquer OS do usuário final, não só Mac.

Escala tipográfica (tamanhos, pesos, ritmo vertical) permanece a atual — só a família muda. Aerada já define o ritmo; recalcular a escala junto seria escopo não pedido.

## 4. Radius

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 8px | inputs, botões |
| `--radius-md` | 12px | cards |
| `--radius-lg` | 16px | modais, painéis grandes |
| `--radius-full` | 999px | badges, avatares, pills reais |

## 5. Shadow

Dois níveis apenas — spec exige sombras "quase imperceptíveis", sem efeito chamativo:

| Token | Valor | Uso |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(17,17,17,.04)` | card em repouso |
| `--shadow-md` | `0 4px 16px rgba(17,17,17,.08)` | elevado: dropdown, modal, hover |

## 6. Iconografia e densidade

Sem alteração. Phosphor duotone continua — já é monocromático-compatível. Densidade Aerada continua — já bate com "muito espaço negativo, hierarquia clara" da spec nova.

## 7. Arquitetura de implementação

Pontos de mudança são concentrados, não espalhados:

- `app/design/lib/tokens.ts` — `PALETTES.lumenva` substitui `PALETTES.sage`, mantém shape/contrato existente do objeto de paleta.
- `app/design/lib/fonts.ts` — troca fonte carregada.
- `app/globals.css` — CSS vars atualizadas (`--color-*`, `--radius-*`, `--shadow-*`) apontando para os novos tokens.
- `tailwind.config.ts` — mapeamento de cor/radius/shadow para as CSS vars, sem introduzir nova convenção de nome de token.
- `docs/design-system/00-overview.md` + `README.md` — atualizados para refletir v2.0 (paleta Lumenva, tipografia system stack), removendo o "locked v1.0" como verdade morta; registrar em `RECONCILIATION-LOG.md` se existir mecanismo equivalente para design-system.

Nenhum componente individual (`components/**`) é migrado nesta fundação — eles herdam via CSS var/Tailwind token. Migração visual de componente por componente é o próximo plano (Shell primeiro).

## 8. Testing

- `pnpm typecheck` + `pnpm lint` após troca de tokens.
- Smoke visual via Playwright: screenshot de 2-3 telas já existentes (dashboard, inbox) antes/depois da troca de token, para confirmar que nada quebrou estruturalmente antes de iniciar migração módulo a módulo.
- Contraste medido via `getComputedStyle`/cálculo de contraste real (light e dark) para `--color-text` sobre `--color-bg`/`--color-surface`, não "a olho".
- Sem `test:db`/`test:e2e` funcional aqui — fundação não toca lógica de negócio, backend ou fluxo.

## 9. Ordem de migração pós-fundação (fora do escopo deste spec, referência)

Shell/navegação → Dashboard → Inbox → Kanban/Pipeline → Contacts → Connections → AI → Admin. Cada módulo: spec/plano próprio via writing-plans, QA visual via Playwright antes do próximo módulo.

## 10. Fora de escopo

- Toggle de dark mode (UI + persistência) — fica para o plano do módulo Shell.
- Migração de qualquer componente/tela individual.
- Alteração de fluxo, comportamento de negócio ou lógica — só pele visual.
- Website (`website/`) — fora desta branch por definição do README de escopo.
