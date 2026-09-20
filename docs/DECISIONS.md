# DECISIONS — Lumenva Agentic Engineering OS

Status: definitivo; decisões aprovadas/consensuadas em 2026-09-16.

## D-001 — Conselho pequeno e limitado, não uma frota

**Decisão:** um Claude Maestro permanente; por task, um executor principal sob demanda escolhido entre Codex e Gemini; e um Reviewer temporário em sessão limpa. Codex é o default para implementação geral. Gemini é preferido quando a task é materialmente Google/Firebase/GCP. Quando possível, Reviewer usa modelo diferente do executor.

**Motivo:** mantém clareza, baixo custo/contexto e separação maker ≠ checker, sem desperdiçar a especialização Google. Verifier, Context Engine, Loop Controller, Policy e Observability continuam componentes do harness, não novos papéis LLM.

## D-002 — Agentic OS ainda não iniciado

**Decisão:** o trabalho atual é planejamento e baseline V0; nenhum arquivo de runtime, migration ou deploy do Agentic OS foi autorizado nesta etapa.

**Motivo:** branches remediation não são prova de V1 pronto e o estado real precisa ser consolidado primeiro.

## D-003 — Remediation como V0

**Decisão:** todas as branches remediation são baseline V0 até reconciliação; nenhuma foi absorvida em `main`.

**Motivo:** existem duplicações, waves sobrepostas, colisões de migration e CI incompleto.

## D-004 — Branches canônicas provisórias

**Decisão:** usar como hipóteses de consolidação `business-os-reconcile-equivalence`, `waves-1-9`, `ai-creator-commerce` e `remaining-entitlements-operating-core`.

**Motivo:** são as linhas identificadas pelo Executor para absorver duplicatas e concentrar reconciliação. V0 deve confirmar ou rejeitar cada uma por evidência Git.

## D-005 — Markdown é interface; estado estruturado é autoridade

**Decisão:** as sete notas são fontes documentais por finalidade; state transacional, checkpoints, evidence e fatos de execução ficam em Postgres/event log/storage.

**Motivo:** Markdown é direto para humanos, mas não garante atomicidade, concorrência, idempotência, query tenant-aware ou recovery robusto.

## D-006 — Floor como isolamento padrão

**Decisão:** uma task por Floor/worktree; sandbox/container somente quando risco exigir.

**Motivo:** preserva simplicidade do fluxo Maestri e adiciona defesa física proporcional ao risco.

## D-007 — Verification determinística e Human Gate

**Decisão:** `verify.sh`/profile real deve passar antes do Reviewer; nenhum merge, push protegido, deploy, produção, delete, migration destrutiva, secrets, auth crítica ou arquitetura irreversível sem Dono.

**Motivo:** teste real e aprovação humana são autoridades diferentes; PASS técnico não é autorização de publicação.

## D-008 — V1 inicia pelo state/event kernel

**Decisão:** após V0 aprovado, V1 será state/event kernel com decisões atômicas, idempotência e session runtime.

**Motivo:** é a fundação para retries, checkpoints, observabilidade e recovery sem depender de conversa ou terminal.

## D-009 — Claude é o único orquestrador; Codex e Gemini são executores

**Decisão:** somente Claude Code com Maestro Mode pode decompor a intenção do Dono, recrutar agentes, escolher o executor, conectar contexto e decidir retry/escalation. Codex e Gemini executam tarefas delimitadas e devolvem evidence; não criam uma hierarquia paralela, não ampliam o próprio escopo e não concedem privilégios.

**Motivo:** preserva uma cadeia única de autoridade e permite usar modelos diferentes sem criar dois control planes. Maestri coordena o canvas; o Permission/Approval Engine continua sendo a autoridade para capabilities, produção e ações críticas.
