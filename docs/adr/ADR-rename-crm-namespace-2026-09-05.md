# ADR: manter `crm_*` como namespace técnico

- **Data:** 2026-09-05
- **Estado:** aceite pelo dono
- **Decisão:** manter sem alteração física o namespace de schema `crm_*` — tabelas, colunas, constraints e referências relacionadas. Não renomear para `lumenva_*`.

## Contexto

O schema contém aproximadamente 895 ocorrências de `crm_*`, incluindo RLS,
realtime, tipos gerados, índices, queries e comparações literais. O nome também
descreve um conceito funcional real: entidades de CRM, e não apenas a marca
anterior do produto.

## Rationale

Manter o namespace evita migration de dados, conflito com upstream e uma janela
de compatibilidade extensa entre nomes antigos e novos. Um rename físico teria
risco extremo de quebrar RLS, realtime, tipos gerados, FKs, índices e código que
compara identificadores literalmente, com ganho apenas cosmético.

O rename de marca para Lumenva permanece válido em textos, UI e metadata onde
autorizado. `crm_*` fica como namespace técnico/funcional estável.

## Referência

`docs/plans/bloco-perigoso-pt-ue-rename-2026-09-05.md`, item R1, opção 1.
