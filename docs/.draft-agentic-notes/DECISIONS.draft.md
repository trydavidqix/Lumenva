# DECISIONS — Lumenva Agentic Engineering OS

Status: rascunho de decisões arquiteturais; decisões dependentes do estado real aguardam consenso.

## D-001 — Três papéis LLM, não uma frota

**Decisão:** um Claude Maestro permanente, um Codex Builder sob demanda e um Reviewer temporário em sessão limpa.

**Motivo:** maximiza clareza, reduz custo/contexto e preserva maker ≠ checker. Verifier, Context Engine, Loop Controller e Observability são código/policies do harness, não agentes.

## D-002 — Reutilizar o Agent Engine existente

**Decisão:** não criar Agent Engine paralelo; usar ports/adapters somente quando uma integração externa for comprovadamente necessária.

**Motivo:** reduzir duplicação, conflito de contratos e superfícies de segurança.

## D-003 — Markdown é interface; estado estruturado é autoridade

**Decisão:** MISSION, ARCHITECTURE, DECISIONS, ROADMAP, TASKS, RUNLOG e BLUEPRINT são notas versionadas/projeções. State transacional, checkpoints, evidência e fatos de execução ficam em Postgres/event log/storage.

**Motivo:** Markdown é excelente para leitura humana, mas não fornece atomicidade, concorrência, idempotência, query tenant-aware ou recovery robusto.

## D-004 — Floor como isolamento padrão

**Decisão:** uma task por Floor/worktree; sandbox/container é condicionado ao risco.

**Motivo:** mantém o fluxo Maestri simples e adiciona defesa física quando houver código não confiável, browser, MCP externo ou secrets.

## D-005 — Verification determinística antes de review

**Decisão:** `verify.sh`/profile real deve passar antes do Reviewer; shell decide PASS/FAIL, não o LLM.

**Motivo:** testes, lint, typecheck, build, integração e security checks produzem evidência reproduzível.

## D-006 — Human Gate obrigatório

**Decisão:** nenhum merge, push protegido, deploy, produção, delete, migration destrutiva, secrets, auth crítica ou arquitetura irreversível sem aprovação explícita.

**Motivo:** PASS técnico não é autorização de publicação nem decisão de risco.

## D-007 — V0 antes de qualquer consolidação

**Decisão:** o estado real de branches/worktrees é input obrigatório do roadmap e da arquitetura final.

**Motivo:** docs históricos, branches de transporte e implementação parcial não podem ser tratados como produto pronto.

## Decisões pendentes

- Qual checkout/branch será a fonte canônica após a auditoria do Executor?
- Quais branches remediation entram em V0 e quais são trabalho V1+?
- Quais claims de “implementado/verificado” têm evidence atual?
