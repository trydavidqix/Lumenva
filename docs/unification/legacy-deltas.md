# Task 04 — Reconciliar CRM Legacy sem regressão

**Status:** BLOCKED_SOURCE_ACCESS

**Motivo:** A tarefa exige a comparação e conciliação de 218 arquivos diferentes em `apps/crm` entre a base `trydavidqix/Lumenva` (destino) e o repositório `trydavidqix/Lumenva-Legacy` (origem, SHA `6e9dbbd901445cfbec53955981a7dab6d644b9da`). No entanto, o acesso ao repositório `trydavidqix/Lumenva-Legacy` foi negado (acesso a repositório privado bloqueado na sandbox Jules).

Conforme as restrições globais do plano ("Confira SHAs, acesso, branches/PRs, LICENSE/notices e paths das cinco fontes. Fonte privada sem acesso fica `BLOCKED_SOURCE_ACCESS`" e "Se fonte privada sem acesso, a tarefa de importação retorna `BLOCKED_SOURCE_ACCESS` e não inventa código"), não é possível continuar sem acesso à fonte da verdade do Legacy para extrair as evidências e deltas.

**Evidência:**
Tentativa de git fetch / clone retorna:
```
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

Nenhum arquivo de código foi alterado, nem dependência instalada localmente, de acordo com as restrições do Owner (nenhum teste ou alteração local feita pela Jules na VM).