# Fase 2 — Mem0: estado de implementação

Data: 2026-08-13
Branch: `ai-platform-foundation`
Estado: **em curso — gate parcial em `docs/evidence/ai-platform/phase-2-mem0-gate.md`; decisão é `HOLD` em `OFF`**

## Decisão operacional atual

Mem0 permanece `OFF` por padrão. Não houve servidor Mem0 iniciado, chave de
produção, chamada a provider, mudança em Vercel/Supabase/WAHA/Redis, nem
promoção para `SHADOW`, `CANARY` ou `ON`. PostgreSQL/Supabase continua a fonte
de verdade; Mem0 é apenas uma projeção reconstruível.

## Entregue

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
| 9 | Lifecycle LGPD (delete automático) + script de reconstrução | `9d280a2f` |
| 10 (parcial) | Gate de release: regressão, failure injection, prova de lifecycle/replay, verificação completa — ver `phase-2-mem0-gate.md` | `33d5de3f` (fix de memória expirada achado no processo) |

## Pendências obrigatórias

Tarefa 10 está **parcialmente fechada** — ver
[`phase-2-mem0-gate.md`](phase-2-mem0-gate.md) para o detalhe completo. Falta
só uma peça, e é a mesma trava de sempre:

1. **Comparação Golden Dataset em shadow** (Passo 2 da Tarefa 10) não rodou.
   O fixture de 25 casos nunca foi populado com conteúdo (Fase 0 só criou o
   contrato de schema); ~13 casos relevantes à Fase 2 já têm a propriedade
   provada por teste real e citado no gate; 3 casos exigem chamada real a
   LLM (julgamento de "preferência substituída") ou não se aplicam à
   arquitetura atual (CRM/knowledge já vencem memória por construção, não
   por ranking). Sem isso, decisão é **manter `OFF`** — não `SHADOW`.

~~Validação no Windows~~ — feita em 2026-08-13. `docker compose config`
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

Até a pendência acima estar fechada com evidência real, não promover Mem0
para `SHADOW`, `CANARY` ou `ON`, não iniciar a Fase 3 e não configurar
credenciais de provider por conveniência.

## Referências operacionais

- Plano: [`../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md`](../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md)
- Runbook do sidecar: [`../../runbooks/mem0.md`](../../runbooks/mem0.md)
- Entrada da iniciativa: [`../../../CODEX-AI-PLATFORM.md`](../../../CODEX-AI-PLATFORM.md)
