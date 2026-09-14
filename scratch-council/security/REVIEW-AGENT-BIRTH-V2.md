# Re-revisão de segurança — Wave 2 AgentDefinition

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, focada no fix de origin/tenant e seus testes. Sem build, testes, merge ou efeitos live.

## Estado revisado

Worktree: `/home/claude/src/worktrees/wave2-agent-birth-2026-09-12`  
Branch: `wave2/agent-birth-2026-09-12`  
HEAD: `4460292f0e7787c699a73089b2cf6b262a3d489b` — `fix(agent-birth): require definition origin tenant`

Arquivos do fix:

- `apps/crm/lib/agent-engine/agent-birth/agent-definition.ts`
- `apps/crm/lib/agent-engine/agent-birth/agent-definition.test.ts`

## Validação nova de origin/tenant

**Veredito: PASS para o gap específico de origin/tenant; falha fechada confirmada.**

- `agent-definition.ts:55-71` rejeita origin ausente/não-objeto, `actor_id` vazio, `tenant_id` vazio, contexto tenant ausente e tenant divergente.
- `:74-82` executa a validação de origin antes de aceitar a definição; qualquer erro retorna `{ ok: false, status: "SHADOW", definition: null }`.
- `:65-69` compara tenants após `trim`, evitando bypass simples por whitespace.
- `:84-116` mantém a validação dos campos canônicos e só retorna `CERTIFIED` quando origin/tenant e todos os campos da definição são válidos.
- Testes `agent-definition.test.ts:76-119` cobrem origin ausente, tenant divergente e actor/tenant vazios; todos exigem `SHADOW` e `definition: null`.

O bypass anterior — certificar definição sem contexto de tenant/origem — não está mais presente nesta função.

## Limites que permanecem

- `actor_id` é apenas uma string não vazia (`:60`); não há cruzamento com identidade autenticada, registry de actors ou capability. O código prova que uma origem foi declarada, não que o actor é legítimo.
- `expectedTenantId` é fornecido pelo chamador; a função não autentica a origem desse contexto. A boundary superior precisa fornecer tenant confiável.
- A validação continua em memória e provider-free; persistência, unicidade e enforcement de todos os callers não são demonstrados pelos testes deste commit.

Esses limites não reabrem o gap específico de correspondência origin/tenant, mas impedem afirmar isolamento sistêmico completo sem validar a camada chamadora.

## Secrets e logging

Busca textual read-only nos dois arquivos por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded ou logging sensível.

## Veredito final

**PASS — a validação nova fecha o gap de origin/tenant no AgentDefinition.** Uma definição sem origin, com tenant ausente/divergente ou actor/tenant vazios permanece `SHADOW` e não é certificada.

Condição de promoção: manter `expectedTenantId` e actor vindos de uma boundary autenticada e acrescentar teste/integration gate que prove que nenhum caller bypassa `validateAgentDefinition`.

SELF-CHECK: PASS — HEAD e arquivos confirmados, revisão read-only nova focada no fix, sem testes/build/merge/efeito externo.
