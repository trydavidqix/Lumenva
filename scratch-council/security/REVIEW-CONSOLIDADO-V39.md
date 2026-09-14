# Revisão consolidada — Wave 4 Event Wake e Wave 6 Client Portal Tokens

Data: 2026-09-13  
Método: leitura read-only e testes independentes no worker.

## Fornalha — Wave 4 Event Wake

Worktree `/home/claude/src/worktrees/wave4-browsermesh-wake-2026-09-12`, SHA `2b4390a13dbc39c6ab9f9c83852a4f4e9ad82ee6` (`fix(wave4): enforce signed actor-aware event`). Código valida HMAC antes de rotear, actor registrado/ativo e capability independente do payload, policy válida e tenant; claims persistidos impedem replay antes da execução.

Teste: **1 arquivo, 10 testes passaram, exit 0**. O código-fonte está commitado no SHA informado; apenas documentos auxiliares permanecem não rastreados.

**PASS.**

## Vértice — Wave 6 client portal token store

Worktree `/home/claude/src/worktrees/wave6-studio-comercial-2026-09-12`, HEAD `2a3810552943d741304e60c1a7f4a698620c98b1`. Tokens são armazenados como hash SHA-256, consumo exige tenant/projeto/escopo, não revogado e não expirado, e single-use é atômico via `UPDATE ... WHERE (single_use=false OR used_at IS NULL) RETURNING`. A migration define unique `(organization_id, token_hash)` e RLS tenant-scoped.

Teste independente contra PostgreSQL descartável: **1 arquivo, 1 teste passou, exit 0**; 16 consumes concorrentes produziram exatamente um sucesso e um `used_at`. A execução usou schema equivalente para o store; RLS com role não-superuser não foi exercida nesta rodada.

**PASS-CONDICIONAL.** Atomicidade e token opaco estão provados; executar a migration completa com role `authenticated` para confirmar RLS.

## Veredito

- Wave 4 Event Wake: **PASS**.
- Wave 6 client portal tokens: **PASS-CONDICIONAL**.

SELF-CHECK: PASS — SHAs/status conferidos, testes reais executados e container PostgreSQL removido.
