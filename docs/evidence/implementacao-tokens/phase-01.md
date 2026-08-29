# Implementação Tokens — Fase 01 Evidence

## Escopo

Fase 1 — convergência CRM + Agent OS sem substituir o runtime operacional atual.

## Baseline refs observadas

- `implementacao-tokens`: `1daa09c732932fc072601fc68743b338a179e62b` no início da execução inline.
- `main`: `3cd5c48ab08e9dbeed3d95896b7a0bbf1df7e35d`.
- Phase 3 Product Agents: `fee440134759c10345b19cead15fb5019ff32683`.
- Phase 4 Shadow/Evals: `63181a1687833ed07ba994918e962d7352cfeb7c`.
- Phase 5 Assisted Autonomy: `7ca817c2f267ea44a96f16c2a9235f3f917657f8`.
- Phase 6 Learning Flywheel: `c89260f2eca600407b0d1381b11b85d4383304a8`.
- Phase 7 Durable Benchmark: `f40725a38c372383be300215c90e5b122f7d9410`.

## Convergência implementada

- Agent OS contracts portados em `lib/agent-engine/contracts/agent-os.ts`.
- Agent Kernel portado como camada de governança, sem substituir `inbound-turn`.
- Product Agents portados como definições governadas, inicialmente SHADOW-safe.
- Policy/Approval/Autonomy/Tool Gateway convergidos com kill switch, R0-R4, idempotência e tenant boundary.
- Shadow/Evals foundation portado com hard gates determinísticos.
- CRM atual continua dono do hot path de WhatsApp/multimodal, LLM seam, handoff humano, memória semântica e tenancy.

## Evidência executável fresca

A branch foi transformada temporariamente em runner de Preview Vercel porque o connector GitHub não expõe shell autenticado. O runner nunca altera produção e será removido antes de qualquer integração com `main`.

### Build/TypeScript

- SHA `405e3aa9a7116df1c3add0ea4c9db1914195eafb` (`feat(agent-os): port shadow eval safety gates`): Preview Vercel `READY`.
- Logs registraram `Compiled successfully` e TypeScript concluído.

### Descobertas do gate ampliado

1. `lint:channels` inicialmente falhou por duas dívidas herdadas da `main`:
   - rota de transporte Meta Cloud API ausente do inventário de dívida conhecida;
   - menção técnica de provider apenas em comentário de `workflows/repository.ts`.
   A causa foi reconciliada sem mudança de comportamento no commit `b22b34f964a799eaf79ee7471a4145bb7cac1bb9`.

2. A suíte unitária completa executada dentro da Vercel precisa de `NODE_ENV=test`; com `NODE_ENV=production`, `lib/env.ts` exige segredos de runtime antes da coleta. O runner foi corrigido sem afrouxar a validação de produção.

3. Com `NODE_ENV=test`, a suíte passou a coletar testes normalmente. Foi observado um RED ambiente-específico em `ai-response-worker-model-routing.test.ts`: o próprio teste simula ausência de autenticação do Vercel AI Gateway, premissa que não é portátil para um runner hospedado na própria Vercel. Este caso não é usado como gate da convergência.

4. Regressões observadas GREEN durante a execução ampliada incluem, entre muitas outras:
   - `tests/unit/escalacao-retomada.test.ts` — 18/18;
   - `tests/unit/mcp-escalacao-tools.test.ts` — 20/20;
   - `lib/waha/ingest-celular.test.ts` — 15/15;
   - `lib/agent-engine/edge/llm/run-model-call.test.ts` — 5/5;
   - `lib/agent-engine/context/fusion.test.ts` — 10/10;
   - `tests/unit/gate-messaging-window.test.ts` — 10/10.

### Gate final focado da Fase 1

O SHA `34a484e4afa27bbff2f47170885ba56a3f4dbcf1` configura um script temporário `scripts/verify-implementacao-tokens-phase-01.sh` para executar:

- `pnpm typecheck`;
- contracts convergence;
- Agent Kernel convergence;
- Product Agents convergence;
- Policy/Tool Gateway convergence;
- Shadow/Evals convergence;
- escalation/handoff regressions;
- WhatsApp/media regressions;
- `pnpm lint:tenant-filter`;
- `pnpm lint:channels`;
- `next build`.

**Estado deste gate:** `QUEUED` no Preview Vercel no momento deste registro. A Fase 1 permanece `IN_PROGRESS` até esse SHA produzir evidência GREEN.

## Evidência histórica usada apenas como referência

- Phase 3 registrou 34/34 testes focados + typecheck/build PASS na branch histórica.
- Phase 4 registrou 59/59 testes focados + typecheck/build PASS na branch histórica.
- Phase 5 registrou 171/171 testes + typecheck/build PASS na branch histórica.
- Phase 6 registrou 235/235 testes + typecheck/build PASS na branch histórica.
- Phase 7 permanece `INCOMPLETE` para decisão de durable engine.

Nenhum desses resultados substitui evidência da branch convergida.

## Status da Fase 1

`IN_PROGRESS`

A implementação estrutural da convergência está presente. O fechamento depende apenas do gate focado fresco no SHA corrente; Customer Memory não recebe migration antes desse gate ficar verde.
