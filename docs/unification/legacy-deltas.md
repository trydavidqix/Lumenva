# Task 04 — Reconciliar CRM Legacy sem regressão

**Status:** BLOCKED_SCOPE

**Motivo:** As divergências foram verificadas com base na API do GitHub na origem Legacy SHA `6e9dbbd901445cfbec53955981a7dab6d644b9da` contra o destino `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`. A contagem aponta uma discrepância em relação ao plano, identificando 218 arquivos diferentes em `apps/crm`. Apesar dos snapshots terem sido integralmente consultados via API, os 218 arquivos divergentes não foram individualmente revisados ou avaliados.

De acordo com o Owner: "The remaining 218 differences have not been individually reviewed; do not call Task 04 complete or import broadly... report BLOCKED_SCOPE for the unreviewed set... with exact remaining work."

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

*Discrepância:* O documento do plano original (PR #79) afirmava 397 caminhos diferentes. A contagem verificada agora é de **218** arquivos diferentes.

### Classificação Inicial

Os seguintes caminhos, embora listados como únicos ou deltas pela auditoria da fonte, são de fato byte-a-byte idênticos ao destino e devem manter sua implementação atual.
**Ação:** `KEEP_DESTINATION`

- `apps/crm/lib/channels/adapters/meta-cloud.ts`
- `apps/crm/lib/channels/meta/webhook.ts`
- `apps/crm/lib/nuvemshop/api-client.ts`
- `apps/crm/lib/ecommerce/types.ts`
- (e os três testes unitários citados correspondentes a esses módulos)

### Trabalho Restante (BLOCKED_SCOPE)
A tarefa foi suspensa por limitação de escopo; o lote de 218 arquivos diferentes ainda não foi inspecionado individualmente, mesmo com acesso garantido à API. Para concluir a Task 04:
1. Analisar individualmente as diferenças dos 218 paths.
2. Classificar cada path em `PORT_DELTA`, `ADAPT`, `DEFER` ou `REJECT`.
3. Se o delta contiver mudanças de comportamento válidas, implementar na allowlist aprovada (preservando tenancy, auth, RLS) em uma PR isolada.
4. Criar testes TDD (RED→GREEN) focados nas capacidades migradas do Legacy no contexto atual.
