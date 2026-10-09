# Task Ownership & Allowlists (Task 01)

Este documento centraliza o mapeamento de paths e de *ownership* (donos) para evitar concorrência ou sobrescrita cruzada de arquivos entre múltiplas sessões da ferramenta de IA operando no repositório `trydavidqix/Lumenva`.

## Arquivos e Paths Compartilhados
Estes caminhos exigem atualizações atômicas e *lock* da tarefa para modificação sem concorrência:
- `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`
- `infra/supabase/migrations/` e `infra/supabase/baseline.sql`
- exports centrais (ex: `packages/core/shared/`).

---

## Mapeamento de Allowlist por Tarefa

Baseado na seção "As 15 tarefas", o escopo (allowlist) exclusivo por tarefa proíbe substituição completa ou migrações de pastas indiscriminadas:

| Tarefa | Allowlists (Caminhos) Definidos |
|---|---|
| **Task 01 - Inventariar fontes** | `docs/unification/inventory.md`, `docs/unification/task-ownership.md` |
| **Task 02 - Contratos** | `docs/unification/architecture.md`, `docs/unification/data-owners.md` |
| **Task 03 - GitHub Actions** | `docs/unification/jules-runbook.md` (Workflow de checks só se justificado) |
| **Task 04 - CRM Legacy** | Subsets exatos autorizados em `apps/crm/`, `docs/unification/legacy-deltas.md` (sem alterar navegação) |
| **Task 05 - Social Brain (Reconciliação)** | `apps/social-web/` e `docs/unification/social-brain-deltas.md` (Sem afetar Core/Worker/MCP alheios) |
| **Task 06 - Social Multiempresa/Adapter** | Subpaths identidade/bridge em `packages/core/social-brain/`, e `docs/unification/social-data-map.md`. |
| **Task 07 - Contas e Eventos Sociais** | Subpaths provider/account e ingestão em `packages/core/social-brain/` e rotas webhooks dedicadas (Sem alterar UI inbox/publisher). |
| **Task 08 - Conteúdo e Mídia Aprovados** | Subpaths conteúdo/publicação em `packages/core/social-brain/`, rotas em `apps/social-web/`, jobs em `apps/social-worker/`, `docs/unification/social-workflow.md`. |
| **Task 09 - Inbox e Automações** | Subpaths inbox/automation em `packages/core/social-brain/`, UI/rotas exclusivas em `apps/social-web/`. |
| **Task 10 - Conteúdo Editorial e Analytics** | Subpaths analytics/editorial em `packages/core/social-brain/`, `docs/unification/social-analytics.md`. |
| **Task 11 - Contratos de Dropshipping** | Subpaths do pacote central Dropshipping base, `src/contracts/events.ts`, `orders.ts`, `markets.ts` (ou path de domínio unificado correspondente se criado), e `docs/unification/dropshipping-domain.md`. |
| **Task 12 - Loja e Catálogo (Read-only)** | Subpath exclusivo adapter de loja (Dropshipping base) e `docs/unification/store-adapter.md`. |
| **Task 13 - Sourcing e Custos (Read-only)** | Subpath de sourcing em pacote Dropshipping, `docs/unification/sourcing-economics.md`. |
| **Task 14 - Pedidos e Interface Drop** | Subpaths de order approval, e rotas em `apps/crm/app/(admin)/(protected)/dropshipping/`, `docs/unification/dropshipping-runbook.md`. |
| **Task 15 - Aceitação/Prontidão** | Arquivos root unificadores (`docs/unification/release-readiness.md`, `rollback.md`, `runbook.md`, `source-closure.md`). |

*(Nota: Caminhos abstratos que não existiam foram alocados conforme os limites da documentação da Tarefa 01 — As tarefas subsequentes devem adequar-se à listagem de caminhos e garantir o isolamento sem ultrapassar suas próprias Allowlists.)*
