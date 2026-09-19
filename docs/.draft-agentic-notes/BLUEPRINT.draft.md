# BLUEPRINT — Lumenva Agentic Engineering OS

Status: rascunho derivado de `AGENTIC ENGINEERING OS - MASTER IMPLEMENTATION BLUEPRINT.md`; a especificação completa será promovida depois do consenso de estado.

## Contrato operacional

```text
AUDIT → PLAN → TASK → FLOOR → BUILD → VERIFY → REVIEW
     → RETRY bounded ou BLOCKED → READY_FOR_HUMAN → DONE
```

## Roles

- **MAESTRO:** audita, planeja, cria task, delega um Builder, interpreta evidence, decide retry/escalation e reporta; não implementa nem aprova o próprio resultado.
- **BUILDER:** implementa menor mudança correta em Floor; executa comandos da task; retorna `FILES_CHANGED`, `COMMANDS_RUN`, `TEST_RESULTS`, `KNOWN_ISSUES`, `STATUS=READY_FOR_REVIEW|FAILED`.
- **REVIEWER:** sessão limpa, read-only; recebe task, acceptance, diff, resultados e evidence; retorna somente `PASS` ou `FAIL` com Blocking/Evidence/Recommended action.

## Estado e notas

MISSION define o quê/por quê; BLUEPRINT define a especificação; ARCHITECTURE define a composição; ROADMAP define V0–V8; TASKS define trabalho atual; RUNLOG registra fatos append-only; DECISIONS registra escolhas e motivos. A ordem de dependência é MISSION → BLUEPRINT → ARCHITECTURE → ROADMAP → TASKS → RUNLOG.

## Persistência

State estruturado em Postgres/Supabase, event log append-only, checkpoints e evidence manifests. Notes Markdown são projeções reconstruíveis e handoffs humanos. RLS, `organization_id` confiável, idempotency keys e hash de artifacts são obrigatórios.

## Contexto

Cada role recebe um ContextPacket hashado com objective, acceptance, risco, fontes autoritativas, arquivos relevantes, rules, decisões, feedback de falhas, capabilities, budgets, verification profile e artifacts; conteúdo irrelevante fica fora e é referenciado por URI/hash.

## Verification e risco

R0–R4 determinam checks cumulativos: scope/format/lint/typecheck/unit; integration/build; DB/RLS/auth/security; E2E/smoke/rollback; Human Gate para publicação e operações irreversíveis. Exit code, timeout, ausência de artifact e checksum divergente nunca são PASS.

## Consenso obrigatório antes da promoção

Comparar este desenho com o inventário do Executor. Atualizar ARCHITECTURE/ROADMAP/TASKS com nomes, SHAs, status e gaps reais somente depois de resolver divergências; não preencher notas definitivas com snapshots não confirmados.
