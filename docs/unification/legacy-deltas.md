# Task 04 — Reconciliar CRM Legacy sem regressão

**Status:** BLOCKED_SCOPE

**Motivo:** A auditoria read-only independente via API confirmou as diferenças entre a origem Legacy SHA `6e9dbbd901445cfbec53955981a7dab6d644b9da` e o destino `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`. A revisão avaliou apenas os caminhos reportados como idênticos, confirmando seus comportamentos no destino; o restante dos 218 deltas não foi analisado. Como a allowlist é fechada e a tarefa não pode ser concluída sem essa análise detalhada, o escopo encontra-se bloqueado (BLOCKED_SCOPE) — o acesso à origem está estabelecido via API, mas a verificação caso a caso precisa de alocação de escopo dedicada.

De acordo com a instrução atualizada do Owner: "feche a Task 04 com o artefato já previsto marcado BLOCKED_SCOPE, preserve a evidência... e deixe claro que nenhum delta foi importado".

### Estatísticas e Discrepância

| Métrica | Contagem |
| --- | --- |
| Legacy (fonte) blobs em `apps/crm` | 2540 |
| Destino blobs em `apps/crm` | 2690 |
| Em comum | 2540 |
| Idênticos byte-a-byte | 2322 |
| **Diferentes** | **218** |
| Apenas na Fonte | 0 |
| Apenas no Destino | 150 |

*Discrepância resolvida:* O plano (PR #79) previa 397 deltas, mas a auditoria constatou precisamente **218** arquivos divergentes.

### Classificação e Comportamentos Auditados

Os seguintes caminhos e seus testes foram auditados e confirmados byte-a-byte idênticos ao destino. Estes artefatos já possuem a implementação canônica com os seguintes comportamentos verificados:
**Ação:** `KEEP_DESTINATION`

- `apps/crm/lib/channels/adapters/meta-cloud.ts`: Tratamento E.164, envio `voice: true`.
- `apps/crm/lib/channels/meta/webhook.ts`: Identificador `phone_number_id`, verificação HMAC SHA-256 e challenge de webhook em texto puro.
- `apps/crm/lib/nuvemshop/api-client.ts`: Headers com `bearer` token.
- `apps/crm/lib/ecommerce/nuvemshop-adapter.ts`: Gestão de tipos e tratativas unknowns.
- `apps/crm/lib/ecommerce/types.ts`: Tipos básicos da interface.
- (bem como os três testes unitários vinculados a esses domínios).

Nenhum desses arquivos requer porte. Não foi importado nenhum escopo adicional ou contrato de BrowserMesh/Shift OS, e a auditoria não representa a conclusão da verificação integral do repositório.

### Trabalho Restante (BLOCKED_SCOPE)
A tarefa encontra-se interrompida por não autorização de revisão massiva dos 218 arquivos divergentes no momento. Para a conclusão da Task 04 em fase posterior, deve-se:
1. Iterar sobre a lista completa dos 218 arquivos divergentes restantes.
2. Analisar e testar funcionalmente cada delta, classificando em `PORT_DELTA`, `ADAPT`, `DEFER` ou `REJECT`.
3. Se o delta comportar um porte útil, incluí-lo na allowlist e implementá-lo via RED/GREEN TDD preservando os padrões arquiteturais de tenancy (RLS), RBAC (requireRole) e auth sem reintroduzir `getSession()`.
