# Review de segurança — Component Registry V1

Data: 2026-09-12  
Alvo: commit Cartógrafa `011df4a8` (`feat(knowledge): add central component registry`), worktree `knowledge-os/component-registry-2026-09-12`.

## Escopo

Revisão estática read-only via SSH no worker `claude@192.168.1.78`, usando `~/.ssh/lumenva_worker`. Arquivos revisados: `apps/crm/lib/knowledge/component-registry.ts` e `component-registry.test.ts`. Nenhum código/teste/build foi executado e nenhuma worktree foi alterada.

## Veredito

**FAIL — duplicata não é normalizada por case.**

### Evidência

`register()` faz apenas `definition.name.trim()` e usa o texto resultante como chave literal do `Map` (`component-registry.ts:13-17`). `get()` também só aplica `trim()` (`:20-22`). Portanto:

```text
registry.register({ name: "Billing", ... })
registry.register({ name: "billing", ... }) // aceito como outra entrada
```

Os testes cobrem duplicata exata e colisão entre `component`, `skill` e `agent`, mas não cobrem `Billing`/`billing`, espaços internos, Unicode ou outras formas equivalentes (`component-registry.test.ts:11-29`).

### Sobrescrita acidental

Para a mesma chave exata, não há sobrescrita silenciosa: `entries.has(name)` rejeita antes de `set()` (`:16-17`). Não existe método de update. Porém a ausência de uma chave canônica case-insensitive permite registrar um componente semanticamente duplicado com capitalização diferente; consumidores que consultem a variante podem obter entradas distintas ou comportamento inconsistente. Isso é uma forma de colisão de namespace, embora não seja overwrite direto.

### Outros limites

- `name` só é validado como string por contrato TypeScript; em runtime, `null`/objeto causaria throw em `.trim()`, não uma decisão controlada.
- Não há validação de `version`/`kind` em runtime além do tipo compilado.
- O registry é local em memória; unicidade não é provada entre processos/instâncias.

## Ação necessária

Introduzir uma função de chave canônica (no mínimo `trim().toLocaleLowerCase()` com política Unicode definida), usar a chave em `register()` e `get()`, e adicionar testes de colisão case-insensitive e espaços periféricos. Se a intenção for permitir nomes sensíveis a case, documentar explicitamente essa política e testar o comportamento; para um namespace central, a opção segura é rejeitar variantes equivalentes.

SELF-CHECK: PASS — somente leitura, sem secrets, sem efeitos externos.
