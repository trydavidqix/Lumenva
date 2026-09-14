# Hermes Unified Learning OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o Hermes governado na branch `design/hermes-unified-learning-os-2026-09-13`, preservando o Flywheel canônico e provando tenant/RLS, evidência e promoção segura.

**Architecture:** Hermes é uma learning plane sobre o Flywheel existente. Sanitiza observações, persiste research/outcomes/capability trust com tenant e RLS, e entrega candidatos ao approval/promotion existente; nunca ativa mudança, amplia permissões ou cria runtime/scheduler paralelo.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, pnpm, Vitest, Playwright, Supabase/Postgres, SQL migrations, RLS e Zod.

**Spec:** `docs/superpowers/specs/2026-09-13-hermes-unified-learning-os-design.md`

## Global Constraints

- Somente no worktree `/home/claude/src/worktrees/design-hermes-unified-learning-os-2026-09-13` e branch `design/hermes-unified-learning-os-2026-09-13`; nunca `main`.
- Estender Flywheel; não criar segundo Agent Engine, scheduler, banco de aprendizagem ou corpus cross-tenant.
- Toda tabela tenant-aware: `organization_id`, RLS, filtro explícito em service role, migration nova, baseline idempotente, manifest, tipos gerados e teste cross-tenant.
- Tenant vem de contexto confiável; nunca do body; backend usa `getUser()`, nunca `getSession()` como prova.
- Hermes não amplia permissões, altera política/runtime, ativa mudança, promove a si mesmo ou promove sem evidência fresca.
- Preservar `PASS`, `FAIL`, `NOT_EXECUTED`, `NOT_PROVEN`, `BLOCKED`; transferência exige `mustRetest: true`.
- Nunca expor secrets, tokens, cookies, bearer plaintext, PII ou transcripts brutos.
- Sem deploy, migration remota, secrets, push ou merge sem autorização separada.
- pnpm canônico: `9.15.9`; outra versão deve ser registrada como limitação.

### Task 1: Schema e migration

**Files:** `supabase/migrations/20260913130000_0163_hermes_learning_os.sql`, `supabase/baseline.sql`, `supabase/migrations/MANIFEST.md`, `apps/crm/tests/unit/hermes-learning-migration-contract.test.ts`.

- [ ] Escrever RED para tabelas, tenant, constraints, índices, RLS/policies, baseline e manifest.
- [ ] Rodar `pnpm --dir apps/crm vitest run tests/unit/hermes-learning-migration-contract.test.ts` e registrar RED.
- [ ] Corrigir apenas via forward-fix; não editar migration aplicada.
- [ ] Rodar GREEN e commitar `feat(ai): reconcile Hermes learning schema contract`.

### Task 2: Tipos gerados

**Files:** `apps/crm/lib/database.types.ts` e contrato de migration.

- [ ] Adicionar asserções para relações/colunas Hermes e tenant obrigatório.
- [ ] Usar banco local/disposable e gerador oficial; nunca produção ou edição manual.
- [ ] Rodar `pnpm --dir apps/crm typecheck`.
- [ ] Commitar somente o tipo gerado: `chore(db): regenerate Hermes learning types`.

### Task 3: Invariantes, evidence e sanitização

**Files:** `apps/crm/lib/agent-engine/hermes/{contracts.ts,evidence-state.ts,promotion-gate.ts,capability-trust.ts,sanitization.ts}` e contratos Hermes.

- [ ] Escrever RED para auto-promoção, actor modelo, evidence stale, `NOT_PROVEN` como `PASS`, capability alterada e secret/transcript.
- [ ] Rodar os contratos focalizados.
- [ ] Implementar guards fail-closed, fingerprint/version/permissões reavaliados e sanitização na origem.
- [ ] Confirmar GREEN e commitar `feat(ai): enforce Hermes evidence and promotion invariants`.

### Task 4: Research, outcomes e tenant isolation

**Files:** `apps/crm/lib/agent-engine/hermes/{research-memory.ts,outcome-ledger.ts,retrieval.ts,runtime-events.ts,read-api.ts,service.ts}` e testes cross-tenant/research/outcome/runtime.

- [ ] RED com org A/B, subject/fingerprint iguais e ausência de leakage.
- [ ] Implementar append-only, idempotência, retrieval same-tenant, `mustRetest: true` e filtros explícitos para service role.
- [ ] Rodar GREEN e commitar `feat(ai): enforce tenant-safe Hermes learning services`.

### Task 5: Flywheel, scheduler e meta-research

**Files:** `apps/crm/lib/agent-engine/flywheel/{orchestrator.ts,outcome-collector.ts,signals.ts,validator.ts}`, `apps/crm/lib/agent-engine/hermes/{scheduled-adapter.ts,meta-research.ts,routing-metrics.ts}` e contratos.

- [ ] RED para scheduler duplicado, budget bypass, recomendação aplicada automaticamente e download/ativação de provider/modelo.
- [ ] Delegar ao Flywheel existente, aplicar budgets de sinais/clusters/candidatos/retrieval/eval/tokens/custo/runtime/no-progress e registrar false PASS.
- [ ] GREEN e commit `feat(ai): consolidate Hermes cycle on Flywheel`.

### Task 6: APIs read-only e UI

**Files:** `apps/crm/app/api/v1/ai/hermes/*/route.ts`, `apps/crm/app/app/ai/evolution/page.tsx`, `apps/crm/components/ai/HermesLearningPanel.tsx` e testes de boundary/panel/read-api/facade.

- [ ] RED para rejeitar ativação/mutação, exigir `getUser()`, Zod, tenant confiável e `ok()`/`fail()`.
- [ ] Renderizar distintamente `PASS`, `NOT_PROVEN`, `NOT_EXECUTED`, `BLOCKED`; não exibir transcript bruto.
- [ ] Manter apenas leitura advisory; não criar endpoint/botão de ativação.
- [ ] GREEN e commit `feat(ai): expose governed Hermes learning read surface`.

### Task 7: Gates executáveis

**Files:** correções comprovadas e `docs/architecture/agent-os/{HERMES-BRANCH-STATUS.md,hermes-next-executable-gates.md}`.

- [ ] Confirmar Node >=22 e pnpm `9.15.9`; registrar divergência.
- [ ] Rodar typecheck, lint tenancy, unitários, harness e `pnpm gov:verify`, cada um com output/exit code.
- [ ] Rodar `test:db` disposable com org A/B e RLS; depois build e E2E/UI.
- [ ] Timeout/ambiente indisponível vira `BLOCKED`, nunca `PASS`.
- [ ] Atualizar docs com SHA, comandos, exit codes, PASS local, `NOT_EXECUTED`, `NOT_PROVEN` e blockers; commit `docs(ai): record Hermes executable verification`.

### Task 8: Revisão e handoff

**Files:** diff contra `main`, spec e docs Hermes.

- [ ] Auditar `git diff main...HEAD` e investigar arquivo fora do escopo.
- [ ] Revisar `activate`, `promote`, `mustRetest`, estados, `organization_id`, secrets, tokens e `console.log` no contexto.
- [ ] Confirmar branch correta e worktree limpo.
- [ ] Entregar SHA, commits, arquivos, gates, blockers e não medido.
- [ ] Parar antes de merge/push/deploy/migration remota; cada ação exige autorização própria.

## Spec coverage and limits

- Cobre Flywheel/Hermes façade, research memory, fingerprints, meta-research, routing, outcome ledger, candidates, evidence, API/UI read-only, scheduling, tenant/RLS, sanitização, migration e rollback.
- Produção, provider real, deploy, pagamento, cliente e ativação efetiva permanecem fora desta autorização.
- Remoção de legado só após paridade provada e autorização própria.
