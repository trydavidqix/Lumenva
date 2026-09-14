# Revisão consolidada — Telar Wave 14 concorrência e Fornalha Wave 16 boundary eval

Data: 2026-09-13  
Método: revisão read-only no worker e execução independente com PostgreSQL descartável.

## Telar — Wave 14 EvolutionReceiptStore

Worktree `/home/claude/src/worktrees/wave14-15-evals-autonomy-2026-09-12`, HEAD `166db114` (`test(wave14): resolve child node from process exec path`). O teste contém `const nodePath = process.execPath`, mas no runtime Vitest esse valor resolve para `/usr/bin/node`, inexistente no worker.

Execução real de `apps/crm/lib/agent-engine/evals/postgres-evolution-receipts.test.ts` contra PostgreSQL descartável: **2/3 testes passaram**; requester não autenticado e integração ActionBus/store passaram. O teste de dois processos expirou em 15 s com dois erros não tratados `spawn /usr/bin/node ENOENT`. Portanto, a correção alegada não produziu a prova concorrente observável.

**BLOCKED.** Corrigir o runtime/path do Node no worker (ou usar um executável existente) e repetir o teste puro até obter dois processos reais e exatamente um vencedor da chave única.

## Fornalha — Wave 16 `boundary-eval.ts`

Commit revisado: `b6e3128649227460ea5b0dbd869834fa4904d732` (`test(wave16): make affect boundary eval adversarial`), worktree `/home/claude/src/worktrees/psycheos-affect-ledger-2026-09-12`.

`runBoundaryEval` gera cinco estados PAD distintos e compara preço/policy de todas as decisões. O teste adversarial injeta uma função contaminada que soma `state.pleasure * 100` ao preço e exige `status === 'FAIL'`; também verifica preço esperado, policy e `statesCompared === 5` no caminho normal. Isso elimina a tautologia anterior. Não há segredo hardcoded nem logging sensível.

Teste do arquivo `apps/crm/lib/psycheos/boundary-eval.test.ts`: **4 testes passaram, exit 0**.

**PASS.** O eval agora detecta efetivamente contaminação por affect; o teste cobre o contrato prometido.

## Veredito consolidado

- Telar Wave 14: **BLOCKED** — concorrência de dois processos continua não provada; `process.execPath` ainda aponta para `/usr/bin/node` inexistente.
- Fornalha Wave 16 boundary eval: **PASS** — comparação adversarial real, quatro testes passam.

SELF-CHECK: PASS — SHAs conferidos, teste puro executado, falha registrada sem mascaramento e container PostgreSQL removido.
