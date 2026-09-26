# Revisão consolidada — Memory Gateway e Budget Router

Data: 2026-09-13  
Escopo: estados atuais no worker, revisão read-only e testes focados independentes.

## Wave 13 — enforcement de projeção via Memory Gateway (Fornalha)

- Worktree: `/home/claude/src/worktrees/wave13-hermes-source-registry-2026-09-12`.
- Commit exato do enforcement identificado no histórico: `ca6776f7` (`fix(wave13): enforce tenant namespace in memory gateway`). Não havia conexão Maestri com “Fornalha” (`maestri list` só mostrou Claude; `maestri check Fornalha` indisponível).
- `gateway-projection.ts` valida `organizationId`, subject/scope e namespace permitido; deduplica backends; filtra cada registro por tenant, subject, scope e namespace antes de supersession/dedup. Registro estrangeiro ou namespace divergente é descartado.
- Testes executados: `gateway-projection.test.ts` **2/2** e `source-registry.test.ts` **4/4**; total **6/6**, exit `0`.
- Não encontrei segredo hardcoded ou logging sensível.

**Veredito: PASS.** O boundary de projeção nega entradas inválidas e não retorna dados de outro tenant/namespace; prova RLS do registry permanece coberta por testes próprios anteriores, fora desta execução.

## Wave 15 — budget routing/débito atômico (Telar)

- Worktree: `/home/claude/src/worktrees/wave15-resource-router-2026-09-13`.
- Commits relevantes atuais: `33b3987d` (`fix(runtime): reserve budgets atomically in postgres`) e `931ed0ef` (`test(runtime): wait for postgres before budget ledger`). Não havia conexão Maestri com “Telar” para confirmação adicional.
- `debitBudget` usa `INSERT ... ON CONFLICT ... DO UPDATE` com condição `consumed + amount <= limit`, retornando linha somente quando o débito é aceito; entradas inválidas falham com `budget_debit_invalid`.
- Testes executados: `budget-ledger.integration.test.ts` **1/1** com PostgreSQL Docker iniciado/derrubado pelo teste (10 débitos concorrentes, 6 aceitos/4 recusados, consumed `90` de limit `100`); `budget-router.test.ts` **3/3**. Total **4/4**, exit `0`.
- Não encontrei segredo hardcoded ou logging sensível.

**Veredito: PASS.** A reserva concorrente é atômica no PostgreSQL e o router permanece fail-closed para orçamento inválido/exaurido.

## Consolidado

- Wave 13 Memory Gateway: **PASS**.
- Wave 15 Budget Router/Ledger: **PASS**.

<self-check>PASS — commits localizados, código lido, testes reais executados e containers descartáveis encerrados.</self-check>
