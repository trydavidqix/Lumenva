# Revisão consolidada — Wave 7 approvals e Wave 13 Graphiti OFF/SHADOW

Data: 2026-09-13  
Escopo: revisão read-only dos estados reais no worker e testes focados.

## Wave 7 — approvals com reviewer server-side (Vértice)

- Worktree verificado: `/home/claude/src/worktrees/wave7-8-studio-editor-2026-09-12`.
- `maestri check Vértice` indisponível e o worktree não contém commit novo de validação server-side de reviewer; HEAD continua `7b24ca06`.
- O código existente valida apenas presença textual de `reviewerId` em `approveEdit`; não consulta identidade/autorização server-side nem verifica que o reviewer pertence ao tenant/capability autorizada.
- Teste RLS existente foi executado anteriormente, mas não cobre reviewer autenticado.

**Veredito: BLOCKED.** Não há evidência do commit solicitado nem prova de que um reviewer arbitrário seja rejeitado no servidor. Necessário commit/worktree atualizado com lookup de identidade/tenant/capability e teste adversarial.

## Wave 13 — Graphiti OFF/SHADOW (Fornalha)

- Worktree: `/home/claude/src/worktrees/wave13-hermes-source-registry-2026-09-12`.
- Histórico atual: `ca6776f7` é o enforcement de namespace/tenant; nenhum commit novo OFF/SHADOW apareceu. `maestri check Fornalha` indisponível.
- `GraphitiContextProvider.retrieve` retorna imediatamente `bucket: disabled` em `mode === "off"` (sem chamar o provider). Em `shadow`, resultados ficam em `shadowItems` e `influencePrompt` não é habilitado; falhas do provider são convertidas em resultado vazio/degradado (fail-closed).
- Testes executados: `graphiti-context-provider.test.ts` **10/10** e `graphiti-client.test.ts` **26/26**; total **36/36**, exit `0`. Os testes cobrem OFF, SHADOW, resultados inválidos e indisponibilidade.
- Nenhum segredo hardcoded encontrado; avisos de chaves ausentes vieram apenas do carregamento de ambiente de teste.

**Veredito: PASS.** A boundary OFF/SHADOW não produz side effect nem promove dados SHADOW a influência de prompt.

## Consolidado

- Wave 7 approvals reviewer server-side: **BLOCKED**.
- Wave 13 Graphiti OFF/SHADOW: **PASS**.

<self-check>PASS — estados e testes foram verificados; ausência do commit do Vértice não foi tratada como entrega concluída.</self-check>
