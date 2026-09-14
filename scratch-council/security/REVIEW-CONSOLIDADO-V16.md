# Revisão de segurança — Prompt Compiler com revalidação interna (Wave 2)

Data: 2026-09-13  
Método: revisão read-only no worker; nenhuma alteração, execução de produção ou merge.

## Estado auditado

- Worktree: `/home/claude/src/worktrees/wave2-agent-birth-2026-09-12`
- HEAD: `4907bf778bb92ef755678e37f7eaec8af792d986` (`4907bf77 fix(agent-birth): revalidate definitions before compiling`)
- Git status: limpo.

## Verificação do fix

`apps/crm/lib/agent-engine/agent-birth/prompt-compiler.ts:18-28` agora exige `origin` e `expectedTenantId`, chama `validateAgentDefinition` internamente e só compila quando `validation.ok` e `definition.status === "CERTIFIED"`. O prompt usa exclusivamente `validation.definition`, não o objeto externo original.

`agent-definition.ts:74-116` revalida origem, tenant, todos os campos textuais e `boundaries`; devolve uma definição normalizada sem o campo `status`. Status externo `CERTIFIED` isolado, definição incompleta e `SHADOW` não conseguem chegar ao prompt.

O teste novo `prompt-compiler.test.ts:101-110` apresenta uma definição forjada como `CERTIFIED` com `mission: ""` e confirma `agent_definition_not_certified`. Os testes existentes também cobrem `SHADOW`, não-mutação e escaping de identidade/boundaries.

## Veredito

**PASS — o gap específico de confiar apenas no status externo está fechado.** O compiler revalida internamente a definição antes de gerar o prompt e falha fechado para status inválido, campos ausentes/vazios, boundaries inválidas e tenant/origin ausentes ou divergentes.

**Risco residual (não bloqueante para este gap):** `AgentDefinitionOrigin.actor_id` é apenas validado como texto não vazio (`agent-definition.ts:55-70`); este módulo não demonstra autenticação/authorização criptográfica do actor. Portanto, a autenticidade do chamador continua sendo responsabilidade da camada acima. O tenant é comparado ao `expectedTenantId`, mas ambos são valores fornecidos ao método.

Não foram encontrados secrets hardcoded nem logging de dados sensíveis nos arquivos auditados.

SELF-CHECK: PASS — SHA, arquivos, linhas e teste de revalidação registrados; revisão somente leitura.
