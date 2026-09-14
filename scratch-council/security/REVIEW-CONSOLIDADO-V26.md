# Revisão consolidada — Wave 2 Agent Birth Registry V2

Data: 2026-09-13  
Método: revisão read-only do código real no worker e execução independente dos testes Vitest focados. Não foi usado PostgreSQL: o Registry V2 atual mantém estado apenas em `Map` em memória, sem persistência.

## Vértice — Wave 2 Agent Birth, Registry V2

Worktree: `/home/claude/src/worktrees/wave2-agent-birth-2026-09-12`  
HEAD observado: `4907bf77` (`fix(agent-birth): revalidate definitions before compiling`).

**FACT — estado do checkout:** as alterações de Registry V2 estão modificadas, mas não commitadas no worktree (`git status --short` lista `agent-definition-registry.ts/.test.ts` e `agent-definition.ts/.test.ts`). Portanto, a prova abaixo é do estado de trabalho atual, não de um SHA versionado.

**FACT — controles lidos:**

- `certifyAgentDefinition` rejeita contexto ausente, definição `SHADOW`/status não `CERTIFIED`, campos obrigatórios ausentes, boundaries vazias e origem inválida.
- `validateOrigin` exige `actor_id`, `tenant_id` e igualdade normalizada entre `origin.tenant_id` e `expected_tenant_id`.
- `validateApproval` exige `approval_id`, `approver_id`, `policy_version`, timestamp parseável, status `APPROVED`, tenant igual ao esperado e aprovador diferente do ator de origem.
- `AgentDefinitionRegistry.register` certifica antes de armazenar, usa chave `id:version` dentro do mapa do tenant, rejeita duplicata e retorna cópias de definição/origem/aprovação. `get`/`getRegistration` sempre recebem `tenantId`, evitando leitura cruzada entre mapas.
- Não há chamadas a provider, segredo hardcoded, `process.env` ou logging de payload sensível nesses arquivos.

**TESTE INDEPENDENTE:** comando executado no worker:

```text
pnpm --dir apps/crm exec vitest run --root /home/claude/src/worktrees/wave2-agent-birth-2026-09-12 --config /home/claude/src/worktrees/wave2-agent-birth-2026-09-12/apps/crm/vitest.config.ts apps/crm/lib/agent-engine/agent-birth/agent-definition.test.ts apps/crm/lib/agent-engine/agent-birth/agent-definition-registry.test.ts apps/crm/lib/agent-engine/agent-birth/prompt-compiler.test.ts
```

Resultado real: **3 arquivos passaram, 29 testes passaram, exit 0** (`15 + 8 + 6`). O único aviso foi de configuração Vite sobre ESM/CommonJS; não afetou a execução.

**Limites de segurança ainda abertos:** a aprovação é um objeto fornecido pelo caller. O código valida formato, status, tenant, timestamp e independência, mas não consulta uma fonte persistente nem verifica assinatura/autoria do `approval_id` ou se `approver_id` possui a capability de aprovar. Do mesmo modo, `origin.actor_id` é apenas uma string estrutural. Um caller que já consiga invocar esta API pode fabricar IDs e uma aprovação estruturalmente válida. Não há prova multi-processo, RLS ou sobrevivência a restart porque o registry é in-memory.

## Veredito

**Vértice — Wave 2 Registry V2: PASS-CONDICIONAL.** O gate local fail-closed de origem, autoria independente, approval, tenant, status e mutabilidade passou nos 29 testes reais; não há segredo/log sensível. Porém, as alterações estão não commitadas e a autenticidade externa de actor/aprovação não é comprovada (nem há persistência/RLS). Para PASS definitivo: commit versionado do estado revisado e validação server-side de approval/actor (ou assinatura/capability verificável), com teste de integração multi-processo/RLS se o registry deixar de ser in-memory.

SELF-CHECK: PASS — código atual lido diretamente no worker, testes executados independentemente, nenhum segredo exposto e nenhuma mutação remota realizada.
