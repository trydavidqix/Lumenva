# Auditoria Etapa 3 — Stripe após 08aa8985

Base: `08aa8985b1d582a4c5227b678e4a34e7a0cf8d86` (`feat/billing: add Stripe checkout subscription boundary`).
Branch desta revisão: `business-os/phase-3-stripe-security-2026-09-12`.

## Guardrails próprios adicionados

- checkout rejeita tenant vazio e normaliza falha/ausência do adapter para `adapter_unavailable`;
- checkout não devolve sessão incompleta;
- webhook exige assinatura presente e previamente verificada;
- replay por `eventId` é idempotente;
- evento fora de ordem é rejeitado;
- `metadata.organization_id` deve coincidir com o tenant resolvido;
- payloads Stripe são redigidos recursivamente antes de qualquer persistência/logging que use o helper;
- indisponibilidade do provider resulta em `DENY`;
- Product/Price ID não são autoridade: checkout usa apenas slug e lookup key canónicos.

A reserva de eventos, a atualização temporal e o tenant resolvido precisam ser persistidos/verificados atomicamente pela camada de runtime. Os helpers não fingem provar essa integração.

## Revisão Torno/Bigorna

- Torno: `70ca77d1ea9f9ae485585fc8fc151029a0c81823`, valida contratos de risco de entitlements; não toca Stripe.
- Bigorna: `27a796451e8e2febd2b100838abd783ae1301d6e`, adiciona migration/RLS/fixtures de entitlements; relevância indireta e fora do escopo por tocar schema.
- Não foram editadas worktrees alheias nem incorporados esses SHAs. Não existe SHA Torno/Bigorna específico de Stripe publicado.

## Findings acionáveis do desenho canónico

1. O checkout original aceitava `organizationId` fornecido pelo caller sem resolução/autorização de sessão. O guardrail local rejeita vazio, mas o wiring HTTP ainda precisa obter o tenant de contexto autenticado e impedir cross-tenant.
2. O checkout original criava a sessão antes de validar preço. A boundary continua dependente de adapter; o adapter deve resolver/validar preço antes do efeito externo ou cancelar a sessão divergente.
3. Não existe route Stripe integrada neste SHA; assinatura criptográfica sobre raw body, idempotência durable e replay não estão provados em runtime.
4. A reserva de `eventId` precisa de unicidade tenant-aware e operação atómica antes do side effect; `ALLOW duplicate` é apenas o contrato de reentrega sem novo efeito.
5. Ordenação temporal precisa de compare-and-set/lock monotónico por tenant/recurso; leitura seguida de upsert permite corrida.
6. Nenhum payload bruto, assinatura, authorization, token, cartão, CVC ou PII desnecessária deve ser persistido.
7. Em rotação de segredo Stripe, a verificação deve aceitar qualquer `v1` válido do header dentro da janela, não apenas o último valor parseado.

## Provas e limites

Testes provider-free e gates locais são vinculados ao SHA final. Stripe CLI/MCP autenticado, Products/Prices reais, webhook real, provider, deploy, produção, RLS/runtime e schema permanecem `NOT_PROVEN`. Nenhuma API manual de Products/Prices foi escrita ou executada.
