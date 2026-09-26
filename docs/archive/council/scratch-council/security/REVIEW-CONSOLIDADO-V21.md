# Revisão de segurança — Costs/Spend (Vértice / Wave 5)

Data: 2026-09-13  
Método: revisão read-only no worker; sem merge, deploy ou efeitos externos.

## Estado auditado

- Worktree: `/home/claude/src/worktrees/wave5-command-center-2026-09-12`
- HEAD: `59cfc03340f71b6db844a79d58606d3aec6c87cc` — `feat(command-center): add tenant-scoped cost entries`
- Git status: limpo.

## Isolamento por tenant

**PASS no builder de overview.** `overview-state.ts:86-96` rejeita qualquer agente, custo, job ou approval cujo `organizationId` difira do `input.organizationId`. Para cada custo, `:100-103` exige `tenantId` não vazio e exatamente igual ao `input.organizationId`; um custo com tenant diferente gera `overview_tenant_mismatch` antes de ser somado ou copiado para `costEntries`.

O commit adiciona teste explícito de custo cross-tenant (`overview-state.test.ts:131-138`) e mantém os testes de mistura de dados. Os custos também exigem owner (`jobId` ou `agentId`) em `:107-109`, evitando entradas sem atribuição.

O acumulado e `costEntries` são derivados somente depois dessas validações. Não existe fallback que descarte o tenant inválido e continue calculando spend.

## Riscos residuais

O builder confia no `input.organizationId` fornecido pelo chamador; autenticação/autorização da sessão que define esse tenant não está neste módulo. Também não há persistência/RLS neste commit, portanto a garantia é de transformação em memória, não prova de isolamento no banco ou na API.

## Secrets e logging

Nenhum secret hardcoded, token, password ou logging sensível foi encontrado nos arquivos do commit.

## Veredito

**PASS — isolamento `tenantId`/`organizationId` correto no escopo do Costs/Spend auditado.** Dados de outro tenant são rejeitados antes de entrar no acumulado ou na saída. Para promoção além desta camada, exigir prova da origem autenticada do `organizationId` e isolamento no armazenamento/endpoint que alimenta o builder.

SELF-CHECK: PASS — SHA, linhas, testes, limites e ausência de secrets documentados; revisão somente leitura.
