# Sourcing Economics

Este documento detalha o funcionamento do cálculo de *unit economics* para dropshipping no Lumenva, focando no sourcing, custo e margem, sem envolver checkout.

## Princípios

1.  **Cálculo Puro**: O serviço de *economics* é uma função pura. Ele recebe entradas explícitas e retorna um estado e, se aplicável, uma recomendação de preço.
2.  **Entradas Explícitas**: Não há valores default. Se qualquer informação essencial (custo, frete, taxas, impostos, CAC, margem, moeda, fornecedor, timestamp) estiver ausente, o resultado é `unknown`.
3.  **Validação de Moeda**: A moeda do fornecedor deve corresponder à moeda do mercado (`currency` === `marketCurrency`). Caso contrário, o resultado é `unavailable`. O sistema não faz conversão automática de moedas.
4.  **Validade da Cotação**: Cotações expiram em 24 horas. Se o timestamp da cotação for mais antigo, o resultado é `unknown`.
5.  **Adapters Pendentes**: As integrações com AutoDS e DSers estão definidas como interfaces. Suas implementações reais dependem de validação externa (`EXTERNAL_VALIDATION_PENDING`), garantindo que não haja chamadas não autorizadas ou código proprietário em uso durante o desenvolvimento.

## Adapters

Os adapters de *sourcing* (ex: AutoDS, DSers) devem implementar a interface `SourcingAdapter`. Atualmente, eles lançam `EXTERNAL_VALIDATION_PENDING` para indicar que a integração real não foi validada ou autorizada. O cálculo de *economics* deve funcionar independentemente desses adapters usando dados sintéticos.
