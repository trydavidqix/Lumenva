# Auditoria Etapa 3 — Stripe após 08aa8985

Base: `08aa8985b1d582a4c5227b678e4a34e7a0cf8d86`.
Branch: `business-os/phase-3-stripe-security-2026-09-12`.
SHA auditado nesta redispatch: a publicar após os gates finais.

## Guardrails próprios

- checkout route contract exige tenant resolvido server-side e entitlement explícito `ALLOW`;
- aceita ambos os discriminadores reconciliados: Bronze `decision: ALLOW/DENY` e Torno `kind: ALLOW/DENY`;
- browser state é obrigatório, tenant-bound, limitado a 15 minutos e rejeitado quando ausente, expirado, adúltero ou divergente;
- Product/Price IDs fornecidos pelo browser são rejeitados;
- webhook route contract rejeita assinatura ausente/não verificada, tenant mismatch e evento fora de ordem;
- replay pelo `eventId` é idempotente, sem novo efeito;
- provider indisponível permanece `DENY`;
- checkout adapter continua fail-closed para adapter ausente, falha do provider e sessão incompleta;
- payloads Stripe têm redaction recursiva para tokens, autorização, secrets, cartão, CVC/CVV e PII.

Os contratos são provider-free. Reserva atómica, compare-and-set temporal e verificação criptográfica do raw body ainda precisam ser ligados à rota/runtime real.

## Torno/Bronze usados como referência

- Torno `70ca77d1ea9f9ae485585fc8fc151029a0c81823`: contrato de autorização fail-closed com tenant/RLS e discriminador `kind`.
- Bronze `53c30dbef0486a27f6acfb3cf838f40de13ceccf`: contexto server-side, discriminador `decision`, receipt de `DENY` e gateway que não executa sem entitlement.
- Nenhuma worktree alheia foi editada ou rebased. Os SHAs foram ligados por tipo/contrato, não incorporados como código.
- A regra Bronze de estado ausente não autorizar foi aplicada ao browser state Stripe: ausência é `DENY`, nunca default-allow.

## Findings acionáveis restantes

1. Não existe route Stripe HTTP integrada neste branch. O route contract é uma fronteira testável, mas não prova leitura de raw body, verificação HMAC/Stripe, persistência ou status HTTP.
2. A assinatura criptográfica deve aceitar qualquer `v1` válido dentro da janela durante rotação de segredo; não reduzir múltiplos `v1` ao último valor.
3. `eventId` precisa de unicidade tenant-aware e reserva atómica antes do side effect.
4. Ordenação precisa de compare-and-set/lock monotónico por tenant/recurso para impedir corridas.
5. `organizationId` final deve vir de sessão/contexto autenticado; browser state nunca é autoridade.
6. Persistência de payload deve usar allowlist/hash redigida; nenhum raw body, assinatura, token, cartão, CVC ou PII desnecessária.
7. Divergência de preço deve ser validada antes do efeito externo ou seguida de cancelamento explícito.
8. Webhook genérico existente continua com finding separado de fail-open em decrypt (`apps/crm/app/api/v1/webhooks/in/[token]/route.ts:95-134`); não foi alterado nesta fatia.

## Provas e limites

Gates locais são vinculados ao SHA final. Stripe CLI/MCP autenticado, Products/Prices reais, webhook real, provider, deploy, produção, RLS/runtime e schema permanecem `NOT_PROVEN`. Nenhuma API manual de Products/Prices foi escrita ou executada.
