# Revisão consolidada — Wave 7 reviewer server-side e Wave 13 Graphiti OFF/SHADOW

Data: 2026-09-13

## Wave 7 — autorização de reviewer

- Worktree: `/home/claude/src/worktrees/wave7-8-studio-editor-2026-09-12`.
- Commit atual: `be43acdf` (`feat(wave7): persist reviewer authorization registry`); `maestri check Vértice` indisponível.
- `studio-reviewer-registry.ts` implementa lookup por `(organization_id, reviewer_id, active=true)` e falha com `reviewer_not_authorized`; migration aplica RLS tenant-scoped.
- Teste PostgreSQL descartável `studio-reviewer-registry.integration.test.ts`: **1/1 passou**, exit `0`; role `NOSUPERUSER NOBYPASSRLS`, reviewer do mesmo tenant aceito, desconhecido/cross-tenant rejeitado e escrita cross-tenant retorna `42501`.
- Gap crítico: `assertAuthorizedReviewer` não é chamado por `StudioEditorStore.approveEdit`; o fluxo de aprovação continua aceitando qualquer `reviewerId` não vazio. A prova valida o registry isoladamente, não o caller efetivo.

**Veredito: BLOCKED.** Integrar a checagem server-side no caminho real de `approveEdit`/API de aprovação e adicionar teste que tente aprovação com reviewer não autorizado.

## Wave 13 — Graphiti OFF/SHADOW

- Worktree: `/home/claude/src/worktrees/wave13-hermes-source-registry-2026-09-12`; nenhum commit novo de OFF/SHADOW apareceu (`maestri check Fornalha` indisponível; estado permanece `ca6776f7`).
- `GraphitiContextProvider.retrieve` retorna `disabled` sem chamar Graphiti em OFF; em SHADOW retorna apenas `shadowItems`, sem `influencePrompt`; erros produzem resultado vazio/degradado.
- Testes executados: `graphiti-context-provider.test.ts` **10/10** e `graphiti-client.test.ts` **26/26**, total **36/36**, exit `0`.
- Nenhum segredo hardcoded ou log sensível encontrado.

**Veredito: PASS.** Boundary OFF/SHADOW permanece fail-closed e sem promoção de dados SHADOW.

## Consolidado

- Wave 7 reviewer server-side: **BLOCKED**.
- Wave 13 Graphiti OFF/SHADOW: **PASS**.

<self-check>PASS — código e testes reais verificados; registry isolado não foi confundido com enforcement no caller.</self-check>
