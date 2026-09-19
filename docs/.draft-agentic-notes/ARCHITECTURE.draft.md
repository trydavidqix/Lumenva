# ARCHITECTURE — Lumenva Agentic Engineering OS

Status: rascunho; estado real de branches pendente de consenso com o Executor.

## Topologia mínima

```text
Maestri Canvas / Maestro Mode
        ↓
Claude Code — MAESTRO permanente
        ↓
MISSION + Blueprint + state/event service + context packet
        ↓
Maestri Floor / git worktree isolado
        ↓
Codex — BUILDER sob demanda
        ↓
scripts/verify.sh / Verification Engine determinístico
        ↓
Claude ou Codex — REVIEWER temporário, sessão limpa
        ↓
Human Gate → merge/deploy autorizado
```

Não recrutar outros agentes por padrão. Context Engine, Loop Controller, Policy, Evidence e Observability são componentes do harness, não papéis LLM adicionais.

## Camadas

- **Control plane:** Maestri Canvas, Roles, Connections, Floors e Partitura.
- **Orchestrator:** Claude Maestro; audita, planeja, delega, interpreta falhas e escala.
- **Execution:** Codex Builder em Floor/worktree; sandbox/container apenas quando o risco justificar.
- **Verification:** shell/scripts/testes reais; exit code e artifacts decidem.
- **Review:** sessão independente, read-only, PASS/FAIL curto com evidência.
- **State:** Postgres transacional + event log append-only; Markdown como projeções humanas.
- **Product runtime:** reutilizar `lib/agent-engine`, Agent Kernel, workers, MCP e contratos existentes.
- **Human governance:** aprovação persistida, com escopo e expiração, antes de efeitos críticos.

## Invariantes

- `organization_id` vem de contexto confiável; RLS e policies são server-side.
- Agentes nunca recebem `service_role` irrestrito.
- Side effects têm policy, idempotency key e evidence.
- Run tem budget de steps, tools, tokens, custo, tempo e attempts.
- Resume usa o mesmo run/checkpoint e não duplica efeitos.
- Memória é derivada; CRM/Postgres é autoridade.
- Maestri pode cair sem perder estado ou bloquear recovery.

## Estado real a reconciliar

Antes de substituir este rascunho por `ARCHITECTURE.md`, o Executor deve confirmar: checkout/branch canônico, Agent Engine efetivamente chamado, migrations e tabelas presentes em `main`, status do gov-loop, CI/Preview, branches remediation ativas, duplicações e worktrees que devem ser preservados/arquivados.
