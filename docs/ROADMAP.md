# ROADMAP — Lumenva Agentic Engineering OS

Status: definitivo para planejamento; alinhado ao estado real do Executor em 2026-09-16.

- **V0 — Baseline e inventário real:** fixar `main`, escolher branches canônicas, eliminar duplicações, reconciliar migrations, validar CI e registrar o estado efetivo do Lumenva.
- **V1 — State/event kernel:** introduzir decisões atômicas, idempotência, session runtime, state estruturado, event log, checkpoints e evidence.
- **V2 — Loop e Context Engine:** formalizar lifecycle, budgets, stop conditions, retries, recovery e context packets mínimos.
- **V3 — Builder/Verifier/Reviewer isolados:** operar Floor/worktree, verifier determinístico e Reviewer independente com contracts e evidence.
- **V4 — Evals de regressão:** medir workflow completo com golden tasks, failure recovery, custo e qualidade.
- **V5 — Observabilidade e custos:** traces, tokens, latência, tools, erros, retries, approvals e redaction.
- **V6 — Maestri governado:** conectar Canvas, Maestro Mode, Notes, Connections, Floors e Partitura ao state durável.
- **V7 — Autonomia assistida:** SHADOW/DRAFT/ASSISTED por capability, tenant e policy, sempre rollbackable.
- **V8 — Benchmark operacional:** comparar runtimes/adapters com workloads reais e critérios fixos antes de adotar alternativas.

## Estado das fases

- **V0: READY / em auditoria e consolidação.** Remediation ainda não está em `main`; CI e suite completa permanecem incompletos.
- **V1–V8: NOT_STARTED.** São planejamento; não há autorização ou claim de implementação do Agentic OS.

## Regra de promoção

Uma fase só avança com evidence atual, Reviewer PASS quando aplicável, relatório de checkpoint e Human Gate. Docs históricos, commits isolados ou arquivos presentes não bastam para marcar uma fase como concluída.
