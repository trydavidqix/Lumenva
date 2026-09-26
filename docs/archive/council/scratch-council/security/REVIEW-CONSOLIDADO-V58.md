# Revisão consolidada — Wave 1 HTTP equivalence e Wave 15 Resource Router

Data: 2026-09-13

## Wave 1 — endpoint HTTP equivalente a CLI/MCP (Vértice)

- Worktree: `/home/claude/src/worktrees/business-os-wave1-equivalence-2026-09-11`.
- SHA: `49325cb6f2a4495a66d6b637aa102f8f01f99c5b` (`feat(wave1): add policy-equivalent HTTP tool execution`).
- `POST /api/v1/mcp/tools` valida Bearer token, rejeita `organizationId` divergente do token, exige `toolName`/args válidos e delega ao mesmo `invokeLumenvaCommand` usado pelo CLI.
- Teste `route-execution.test.ts`: **2/2 passou**, exit `0`; compara resultado HTTP com CLI e handler MCP direto e prova rejeição cross-tenant (403).
- Nenhum segredo hardcoded ou logging sensível encontrado.

**Veredito: PASS.** O gap de equivalência HTTP foi fechado no endpoint e no teste de contrato.

## Wave 15 — harness de persistência com migration real (Fornalha)

- Worktree: `/home/claude/src/worktrees/wave15-resource-router-2026-09-13`.
- SHA: `397247c46f23b566bbf9462b3d6a845cd03e6cdd` (`test(resource-router): apply migration before persistence harness`).
- O harness agora cria `fn_user_org_ids()`, lê e aplica `20260913160000_resource_router_rls.sql` antes de `ensureResourceRouterStore`, em PostgreSQL descartável.
- Teste `resource-router-persistence.integration.test.ts`: **2/2 passou**, exit `0`; persistência sobrevive a pool novo e a mesma chave de reroute só é aceita uma vez em chamadas concorrentes.
- Nenhum segredo hardcoded ou logging sensível encontrado.

**Veredito: PASS.** A correção elimina o falso positivo anterior de tabela sem migration; persistência e idempotência foram realmente exercitadas no PostgreSQL.

## Consolidado

- Wave 1 HTTP catalog/execution: **PASS**.
- Wave 15 persistence harness: **PASS**.

<self-check>PASS — SHAs confirmados, endpoint/policies lidos e testes reais executados com exit 0.</self-check>
