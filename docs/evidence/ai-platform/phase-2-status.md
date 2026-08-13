# Fase 2 — Mem0: estado de implementação

Data: 2026-08-11
Branch: `ai-platform-foundation`
Estado: **em curso — não é gate de release**

## Decisão operacional atual

Mem0 permanece `OFF` por padrão. Não houve servidor Mem0 iniciado, chave de
produção, chamada a provider, mudança em Vercel/Supabase/WAHA/Redis, nem
promoção para `SHADOW`, `CANARY` ou `ON`. PostgreSQL/Supabase continua a fonte
de verdade; Mem0 é apenas uma projeção reconstruível.

## Entregue até a Tarefa 8

| Tarefa | Entrega | Commits principais |
|---|---|---|
| 1 | `MemoryPort`, tipos e adapter nulo | `a91e47fb` |
| 2 | Sanitização determinística contra segredos e dados sensíveis | `c326ba98`, `ecb86180` |
| 3 | Extração tipada, com autoridade protegida e fail-closed | `6ff940e5`, `dc2f5401`, `76401511`, `fdc67286` |
| 4 | Adapter REST Mem0 OSS, escopado por organização/contacto | `0a0213fd` |
| 5 | Sidecar Compose opcional, profile `ai-memory` e runbook | `f4261f01`, `c24aef84` |
| 6 | Projeção assíncrona e idempotente de eventos oficiais | `b5bc8bf5`, `a1f42e13` |
| 7 | Provider de contexto e comparação em shadow | `d5bd0b6b`, `5d2d5cb2` |
| 8 | Fusão de contexto no prompt só sob rollout explícito e fail-closed | `6f6be4d7`, `7ce49214` |

As revisões independentes das Tarefas 1–8 aprovaram os seus escopos finais. A
última regressão focada da Tarefa 8 executou 42 testes; typecheck, lint e
`git diff --check` passaram nessa árvore. Estes resultados não substituem o
gate completo da fase.

## Pendências obrigatórias

1. Tarefa 9: lifecycle/rebuild e prova de apagamento/reconstrução para LGPD.
2. Tarefa 10: Golden Dataset em shadow, falhas/outage e decisão `GO` ou `NO-GO`.
3. ~~Validação no Windows~~ — feita em 2026-08-13. `docker compose config`
   válido nos dois arquivos; healthcheck do profile `ai-memory` responde
   `HEALTHY` e `/auth/setup-status` responde `{"needsSetup":true}` num boot
   limpo, sem intervenção manual. Achado no caminho: a imagem pinada
   `mem0/mem0-api-server:0.1.117` não existe mais no Docker Hub e `latest` é
   ARM64-only — sem build amd64 publicado. Caminho adotado: build local a
   partir do source oficial (commit `96d45b78`), com 3 correções sobre o
   `server/Dockerfile` deles (dependência `psycopg[binary]` ausente, pasta
   `/app/history` nunca criada, migração `alembic` nunca executada) — receita
   completa em `docs/runbooks/mem0.md`. Ainda não validado: confirmação de que
   o Mem0 OSS em execução respeita `Idempotency-Key` (requer bootstrap com
   chave de provider real, fora do escopo desta validação de infraestrutura).

Até estas pendências estarem fechadas com evidência, não promover Mem0 para
`SHADOW`, `CANARY` ou `ON`, não iniciar a Fase 3 e não configurar credenciais
de provider por conveniência.

## Referências operacionais

- Plano: [`../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md`](../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md)
- Runbook do sidecar: [`../../runbooks/mem0.md`](../../runbooks/mem0.md)
- Entrada da iniciativa: [`../../../CODEX-AI-PLATFORM.md`](../../../CODEX-AI-PLATFORM.md)
