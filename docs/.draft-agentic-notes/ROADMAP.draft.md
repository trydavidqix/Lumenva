# ROADMAP — Lumenva Agentic Engineering OS

Status: rascunho; alinhamento V0/V1 com as branches reais do Executor pendente.

- **V0 — Baseline e inventário real:** reconciliar checkout, branches, worktrees, código, docs, duplicações, gaps e evidências atuais.
- **V1 — State/event kernel:** consolidar mission/task/run/attempt/checkpoint/evidence e projeções das notas.
- **V2 — Loop e Context Engine:** formalizar lifecycle, budgets, stop conditions, retries, recovery e context packets mínimos.
- **V3 — Builder/Verifier/Reviewer isolados:** operar Floor/worktree, verifier determinístico e Reviewer independente com contracts e evidence.
- **V4 — Evals de regressão:** medir workflow completo com golden tasks, failure recovery, custo e qualidade.
- **V5 — Observabilidade e custos:** traces, tokens, latência, tools, erros, retries, approvals e redaction.
- **V6 — Maestri governado:** conectar Canvas, Maestro Mode, Notes, Connections, Floors e Partitura ao state durável.
- **V7 — Autonomia assistida:** SHADOW/DRAFT/ASSISTED por capability, tenant e policy, sempre rollbackable.
- **V8 — Benchmark operacional:** comparar runtimes/adapters com workloads reais e critérios fixos antes de adotar alternativas.

## Regra de alinhamento

O Executor deve mapear cada branch remediation para: já em `main`, candidata a V0, candidata a V1+, duplicada/obsoleta, bloqueada ou aguardando decisão. O roadmap definitivo não pode declarar uma fase GO somente porque existem arquivos ou commits.
