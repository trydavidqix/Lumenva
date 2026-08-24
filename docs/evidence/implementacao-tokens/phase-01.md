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

## Convergência estática confirmada

- CRM atual possui o hot path `lib/agent-engine/agent/inbound-turn.ts` e ele já compõe contexto, compaction, memória, skills, RAG, guardrails, handoff, cases, multimodal e envio via adapter.
- CRM atual possui o seam canônico `lib/agent-engine/edge/llm/run-model-call.ts` com config por org, BYOK, budget pre-call, cache accounting, usage/cost/latency e tracing.
- CRM atual possui memória semântica sob `lib/agent-engine/memory/**`.
- CRM atual possui multi-tenancy/RLS como invariante de arquitetura.
- Kernel/Product Agents/Policy/Evals estão ausentes da branch convergida e existem em linhas Agent OS separadas; serão portados seletivamente.
- Migration Agent OS `20260819130000_0123_agent_memory_tables.sql` colide conceitualmente/numérica com o histórico atual; não será copiada com o mesmo número.

## Baseline executable gates

Os comandos requeridos pelo plano são:

```text
pnpm typecheck
pnpm test:unit
pnpm lint:channels
pnpm lint:tenant-filter
```

**Estado atual:** `NOT_EXECUTED_IN_THIS_TOOL_ENVIRONMENT`.

Motivo: nesta sessão, o repositório privado está acessível por GitHub API/connector, mas não existe um checkout autenticado com shell/rede para executar `pnpm`. O container local não resolve `github.com`, e o connector GitHub não expõe execução arbitrária de comandos. Isso é registrado como limitação de evidência, não convertido em PASS ou FAIL.

## Evidência histórica usada apenas como referência

- Phase 3 registrou 34/34 testes focados + typecheck/build PASS na branch histórica.
- Phase 4 registrou 59/59 testes focados + typecheck/build PASS na branch histórica.
- Phase 5 registrou 171/171 testes + typecheck/build PASS na branch histórica.
- Phase 6 registrou 235/235 testes + typecheck/build PASS na branch histórica.
- Phase 7 permanece `INCOMPLETE` para decisão de durable engine.

Nenhum desses resultados fecha a Fase 1 convergida; serão rerodados quando houver runner disponível no SHA da branch.

## Status da Fase 1

`IN_PROGRESS`

Task 1 tem o mapa de convergência registrado. O gate executável continua pendente e impede marcar a fase como concluída, mas não impede preparar contratos/testes de convergência de forma seletiva.
