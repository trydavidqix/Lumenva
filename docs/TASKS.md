# TASKS — Estado operacional inicial

Status: vivo/incremental; fotografia inicial consensuada em 2026-09-16. Nenhuma task do Agentic OS foi executada.

## V0-01 — Fixar baseline e checkout canônico

- **Status:** READY
- **Priority:** P0
- **Objective:** escolher checkout/branch canônico e confirmar o `main` de referência antes de consolidar qualquer remediation.
- **Current State:** `main` remoto em `fec2d253`; múltiplos worktrees e branches ativos.
- **Scope:** inventário Git, branches, worktrees, dirty state, base SHAs e fonte de verdade.
- **Out of Scope:** implementar Agentic OS, merge, deploy ou apagar branches.
- **Acceptance Criteria:** checkout canônico documentado; branches relevantes listadas; nada não verificado tratado como concluído.
- **Verification:** `git status`, `git branch -a`, `git worktree list`, comparação de SHAs e revisão independente.
- **Floor:** PENDING
- **Builder:** PENDING
- **Attempt:** 0/3
- **Reviewer:** PENDING
- **Result:** PENDING

## V0-02 — Reconciliar branches remediation

- **Status:** BLOCKED_BY_V0-01
- **Priority:** P0
- **Objective:** validar as quatro canônicas provisórias e classificar absorver, duplicada, obsoleta ou bloqueada.
- **Current State:** propostas: `business-os-reconcile-equivalence`, `waves-1-9`, `ai-creator-commerce`, `remaining-entitlements-operating-core`; nada em `main`.
- **Scope:** equivalência de commits, duplicações, waves sobrepostas e conflitos.
- **Out of Scope:** resolver por merge sem acceptance e sem Human Gate.
- **Acceptance Criteria:** matriz branch → destino → evidence → risco → decisão.
- **Verification:** diff/log/merge-base e Reviewer independente.
- **Floor:** PENDING
- **Builder:** PENDING
- **Attempt:** 0/3
- **Reviewer:** PENDING
- **Result:** PENDING

## V0-03 — Reconciliar migrations e testes

- **Status:** BLOCKED_BY_V0-02
- **Priority:** P0
- **Objective:** resolver colisões de nome/timestamp de migration e paths hardcoded de testes.
- **Current State:** divergências confirmadas; `remaining-entitlements-operating-core` tem referência de migration antiga.
- **Scope:** migration chain, baseline/manifest e testes afetados.
- **Out of Scope:** aplicar migration em produção.
- **Acceptance Criteria:** cadeia única proposta, conflitos classificados e checks reproduzíveis.
- **Verification:** teste de schema install/update, testes afetados e Reviewer.
- **Floor:** PENDING
- **Builder:** PENDING
- **Attempt:** 0/3
- **Reviewer:** PENDING
- **Result:** PENDING

## V0-04 — Validar CI e suíte completa

- **Status:** BLOCKED_BY_V0-02
- **Priority:** P0
- **Objective:** obter evidência completa de CI/suítes para a baseline consolidada.
- **Current State:** 19 testes direcionados, typecheck/lint incremental e `git diff --check` passam localmente em `business-os-audit-stripe`; CI remoto vermelho/incompleto; Docker indisponível; outras 14 branches sem CI.
- **Scope:** checks locais/remotos disponíveis, classificar falha de produto versus infraestrutura.
- **Out of Scope:** declarar GO com apenas testes direcionados.
- **Acceptance Criteria:** relatório de checks por branch/canônica, falhas reproduzíveis e decisão V0.
- **Verification:** commands reais do profile `full`/schema/security conforme escopo.
- **Floor:** PENDING
- **Builder:** PENDING
- **Attempt:** 0/3
- **Reviewer:** PENDING
- **Result:** PENDING

## V1-01 — State/event kernel

- **Status:** BACKLOG
- **Priority:** P1
- **Objective:** iniciar o Agentic OS após V0 aprovada com decisões atômicas, idempotência e session runtime.
- **Current State:** apenas blueprint/documentação; não iniciado.
- **Depends On:** V0-01, V0-02, V0-03, V0-04 e Human Gate de promoção.
- **Acceptance Criteria:** definidos no `BLUEPRINT.md`; nenhum código começa antes do gate V0.
- **Verification:** PENDING
- **Floor:** PENDING
- **Builder:** PENDING
- **Attempt:** 0/3
- **Reviewer:** PENDING
- **Result:** PENDING
