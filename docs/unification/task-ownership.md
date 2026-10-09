# Task Ownership & Allowlists (Task 01)

Este documento centraliza o mapeamento de paths e *ownership* (donos) para as sessões paralelas da unificação, mantendo limites estritos e evitando concorrência destrutiva sobre a estrutura aprovada no plano `2026-10-09-lumenva-crm-social-dropshipping-jules.md`.

## Arquivos e Paths Compartilhados

Arquivos que afetam múltiplos pacotes, banco de dados ou configurações globais possuem escrita permitida a uma única sessão operando por vez:
- **Lockfile / Config:** `pnpm-lock.yaml`, `package.json`, `.env.example`, manifests centrais.
- **Banco de Dados Global:** `infra/supabase/migrations/`, `infra/supabase/baseline.sql` e dependências afins.

---

## Allowlists Exclusivas das 15 Tarefas

A lista abaixo reflete **exatamente** os limites de paths definidos na documentação das "15 tarefas" do plano mestre. Nenhuma tarefa pode ultrapassar sua listagem de caminhos, sendo que paths globais compartilhados bloqueiam tarefas paralelas até as conciliações ou merge de Tasks específicas (Ex: Task 15).

> **Aviso de Gate:** Tarefas 04 a 14 ficam retidas (bloqueadas para início) até que a documentação, arquitetura e limites descritos nas Tasks 01 a 03 estejam formalmente aprovadas/fundidas (integradas).

| Tarefa | Allowlists de Escopo (Paths Literais do Plano) | Status de Base |
| --- | --- | --- |
| **Task 01 — Inventariar fontes e ownership** | `docs/unification/inventory.md`, `docs/unification/task-ownership.md` | Documentos Propostos |
| **Task 02 — Contratos, ownership e arquitetura de domínio** | `docs/unification/architecture.md`, `docs/unification/data-owners.md` | Documentos Propostos |
| **Task 03 — GitHub Actions e execução Jules** | `docs/unification/jules-runbook.md` (e `.github/workflows/ci.yml` se comprovado bloqueio de CI vital) | Documentos Propostos |
| **Task 04 — Reconciliar CRM Legacy sem regressão** | Subset aprovado e exato de `apps/crm/`, testes correspondentes e migration aditiva (se necessária), `docs/unification/legacy-deltas.md`. (Não alterar navegação global) | Bloqueada / Aguardando Integração (1-3) |
| **Task 05 — Reconciliar Social Brain já incorporado** | Paths selecionados de `apps/social-web/` e `docs/unification/social-brain-deltas.md`. (Não alterar core, worker, MCP, manifests ou paths das Tasks 06–10) | Bloqueada / Aguardando Integração (1-3) |
| **Task 06 — Modelo social multiempresa e adapter de contatos** | Subpaths de identidade/bridge CRM em `packages/core/social-brain/`, testes correspondentes e `docs/unification/social-data-map.md`. | Bloqueada / Aguardando Integração (1-3) |
| **Task 07 — Contas, credenciais e entrada de eventos sociais** | Subpaths de provider/account e ingestão em `packages/core/social-brain/`, rotas próprias de webhook e fixtures. | Bloqueada / Aguardando Integração (1-3) |
| **Task 08 — Conteúdo, referências, mídia e publicação aprovados** | Subpaths de conteúdo/referência/publicação em `packages/core/social-brain/`, rotas próprias em `apps/social-web/`, jobs existentes em `apps/social-worker/`, testes e `docs/unification/social-workflow.md`. | Bloqueada / Aguardando Integração (1-3) |
| **Task 09 — Inbox, automações sociais e takeover humano** | Subpaths inbox/automation em `packages/core/social-brain/`, UI/rotas exclusivas de inbox em `apps/social-web/`, worker e fixtures/testes; migration aditiva somente se necessária. | Bloqueada / Aguardando Integração (1-3) |
| **Task 10 — Conteúdo editorial e analytics sociais** | Subpaths analytics/editorial em `packages/core/social-brain/`, testes e `docs/unification/social-analytics.md`. | Bloqueada / Aguardando Integração (1-3) |
| **Task 11 — Contratos e domínio de dropshipping** | Contratos/state machine em subpath próprio do pacote escolhido na Task 02, testes correspondentes e `docs/unification/dropshipping-domain.md`. | Bloqueada / Aguardando Integração (1-3) |
| **Task 12 — Loja e catálogo em leitura** | Subpath exclusivo do adapter de loja, testes e `docs/unification/store-adapter.md`. | Bloqueada / Aguardando Integração (1-3) |
| **Task 13 — Sourcing, custo e margem sem checkout** | Subpath próprio de sourcing e serviço puro de unit economics no pacote dono, testes e `docs/unification/sourcing-economics.md`. | Bloqueada / Aguardando Integração (1-3) |
| **Task 14 — Operação de pedidos, aprovações e interface Lumenva** | Subpaths próprios de workflow/order approval e rota UI dedicada sob `apps/crm/app/(admin)/(protected)/dropshipping/`, testes e `docs/unification/dropshipping-runbook.md`. | Bloqueada / Aguardando Integração (1-3) |
| **Task 15 — Aceitação integrada, recuperação e prontidão** | `docs/unification/release-readiness.md`, `rollback.md`, `runbook.md` e `source-closure.md`. (Mais fixtures E2E existentes) | Bloqueada / Aguardando Integração total (1-14) |