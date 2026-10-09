# Inventário de Fontes e Ownership (Task 01)

Este inventário consolida as informações do repositório alvo e das fontes externas que serão unificadas no Lumenva, conforme auditoria de escopo real realizada de acordo com o plano documentado `docs/superpowers/plans/2026-10-09-lumenva-crm-social-dropshipping-jules.md`.

## Acesso e Auditoria de SHAs

| Repositório | SHA Observado (`main`) no plano | Acesso / Status Local Jules | Disposition Inicial (Baseado no Plano) |
| --- | --- | --- | --- |
| `trydavidqix/Lumenva` (Destino) | `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` | **Lido (Sessão atual)** | Destino. Preservar e reconciliar antes de importar. |
| `trydavidqix/Lumenva-Legacy` | `6e9dbbd901445cfbec53955981a7dab6d644b9da` | `BLOCKED_SOURCE_ACCESS` | `PORT_DELTA`: 2.814 iguais, 397 diferentes; portar deltas com testes, sem regressão de `apps/crm`. |
| `trydavidqix/lumenva-social` | `54c3b32c934462277320874fc3630882d2855f39` | `BLOCKED_SOURCE_ACCESS` | `ADAPT`: app pessoal SQLite local; adaptar deltas de publicação e contatos. |
| `trydavidqix/lumenva-social-brain` | `80a877bde72bd6a27a5d20ff2f6231a7e0f72995` | `BLOCKED_SOURCE_ACCESS` | `RECONCILE/KEEP_DESTINATION`: parcialmente presente no web/worker, reconciliar sem duplicar apps/workers. |
| `trydavidqix/Drop` | `9259af5f4ec49cbc58f2d0f9b1e2776c8c07deec` | `BLOCKED_SOURCE_ACCESS` | `IMPLEMENT`: usar contratos, sem servidor ou mock cego; operação não validada na fonte. |

**Nota Crítica sobre Divergências:**
Devido ao status `BLOCKED_SOURCE_ACCESS` atual (a VM não possui credenciais/chaves para ler os repositórios originais), é impossível gerar novas comparações de árvores diretamente pela sessão. Conforme especificado, nenhuma fonte inacessível é declarada como "migrada". Hash igual não prova comportamento igual e a divergência interrompe os ports até que as fontes sejam revalidadas.

## Checks do GitHub Actions e Estado Canônico

As validações ativas de CI (`.github/workflows/ci.yml`) na base atuam como o único executor de testes durante essas execuções remotas isoladas. Validações não devem ser realizadas usando o Windows host; a VM apenas reflete o estado remoto reportado.

**Status Base Atual (herdado do Run 36399564348, Branch `main`, SHA `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`):**

- **Job `verify`:**
  - `pnpm typecheck`: **FAIL** herdado (Erro `TS2345` em `apps/website/next.config.ts(66,29)` devido a mismatch de tipos Next 16.3.5 vs 16.3.2). *(Não alterar dependências ou toolchain nesta Task 01)*
  - `pnpm lint`: PENDENTE / PRÓPRIO
  - `pnpm lint:channels`: PENDENTE / PRÓPRIO
  - `pnpm test:harness && pnpm harness:check`: PENDENTE / PRÓPRIO
  - `pnpm test:unit`: PENDENTE / PRÓPRIO
  - `pnpm test:shell`: PENDENTE / PRÓPRIO
- **Job `invariants`:**
  - `pnpm test:db`: PENDENTE / PRÓPRIO
