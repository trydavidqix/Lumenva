# ARCHITECTURE — Lumenva Agentic Engineering OS

Status: definitivo para planejamento; estado confirmado em consenso com o Executor em 2026-09-16. O Agentic OS ainda não foi implementado.

## Arquitetura atual real

- O checkout compartilhado contém múltiplos worktrees e branches de remediation; não existe ainda uma baseline única consolidada.
- `main` remoto está em `fec2d253`; nenhuma remediation foi absorvida em `main`.
- Quatro linhas canônicas provisórias foram identificadas: `business-os-reconcile-equivalence`, `waves-1-9`, `ai-creator-commerce` e `remaining-entitlements-operating-core`.
- `business-os-audit-stripe` tem 19 testes direcionados, typecheck/lint incremental e `git diff --check` passando localmente; CI está vermelho, a suíte completa não terminou e o teste Docker está indisponível.
- As demais 14 branches ainda não têm CI executado. Há duplicações, waves sobrepostas, colisões de migrations e paths de teste antigos.
- O runtime/produto existente deve ser auditado e reutilizado; a existência de código ou documentação de Agent OS não significa que o Agentic OS esteja operacional.

## Arquitetura alvo mínima

```text
Maestri Canvas / Maestro Mode ON
        ↓
Claude Code — MAESTRO permanente
        ↓
MISSION → BLUEPRINT → ARCHITECTURE → ROADMAP → TASKS → RUNLOG
        ↓
Maestri Floor / git worktree isolado por task
        ↓
Codex — BUILDER sob demanda
        ↓
scripts/verify.sh / Verification Engine determinístico
        ↓
Claude ou Codex — REVIEWER temporário, sessão limpa
        ↓
Human Gate → merge/deploy autorizado
```

Não recrutar outros agentes por padrão. Context Engine, Loop Controller, Policy Engine, Evidence Store e Observability são componentes do harness, não papéis LLM adicionais.

## Camadas

- **Control plane:** Maestri Canvas, Roles, Connections, Floors e partitura `Lumenva Engineering Loop`.
- **Orchestrator:** Claude Maestro; audita, planeja, delega, interpreta falhas e escala.
- **Execution:** Codex Builder em Floor/worktree; sandbox/container apenas quando o risco justificar.
- **Verification:** shell/scripts/testes reais; exit code e evidence decidem.
- **Review:** sessão independente, read-only, PASS/FAIL com evidence.
- **State:** Postgres transacional + event log append-only; Markdown como projeções humanas.
- **Product runtime:** reutilizar o runtime Agent Engine existente depois da auditoria V0.
- **Human governance:** approval persistido, com escopo e expiração, antes de efeitos críticos.

## Invariantes

- `organization_id` vem de contexto confiável; RLS e policies são server-side.
- Agentes nunca recebem `service_role` irrestrito.
- Side effects têm policy, idempotency key e evidence.
- Cada run tem budget de steps, tools, tokens, custo, tempo e attempts.
- Resume usa o mesmo run/checkpoint e não duplica efeitos.
- Memória é derivada; CRM/Postgres é autoridade.
- Maestri pode cair sem perder estado ou bloquear recovery.

## Limite entre V0 e V1

V0 é consolidação do código e branches existentes: fixar `main`, escolher canônicas, eliminar duplicação, reconciliar migrations e validar CI. V1 começa somente depois da baseline aprovada e implementa state/event kernel com decisões atômicas, idempotência e session runtime.
