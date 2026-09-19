# Auditoria Etapa 3 — contrato e segurança Stripe

Base auditada: `mvp/crm-completo` em `e45bdc4f1b18c063473e9bccdafd0d056329037a`.
Branch desta fatia: `business-os/phase-3-contract-security-2026-09-12`.

## Guardrails provider-free adicionados

- assinatura ausente ou não verificada: `DENY`;
- evento repetido por `eventId`: `ALLOW` idempotente, sem novo efeito;
- evento anterior ao último timestamp do recurso: `DENY`;
- `tenant_id` do payload diferente do tenant resolvido: `DENY`;
- payloads redigidos recursivamente antes de logs/auditoria;
- provider indisponível: `DENY`;
- Checkout resolve apenas slug canónico do catálogo; `productId`/`priceId` são sempre rejeitados como autoridade.

A reserva de `eventId` e a atualização temporal precisam ser persistidas atomicamente pela camada durable que consumir este contrato. Este módulo não declara prova de concorrência, banco, provider ou produção.

## Findings acionáveis independentes

1. `CRITICAL`: `apps/crm/app/api/v1/webhooks/in/[token]/route.ts:95-134` transforma falha de descriptografia em `hmacSkipped` e grava `valid_signature=true` por omissão. Secret configurado, decrypt indisponível, assinatura ausente ou inválida devem rejeitar sem mutação.
2. `HIGH`: `apps/crm/lib/waha/webhook-auth.ts:17-25,61-73` permite assinatura desligada por default. Tornar a fronteira canónica fail-closed ou documentar/adicionar autenticação equivalente explicitamente provada.
3. `HIGH`: rotas genérica, WAHA e Meta persistem `raw_body`/payload e headers quase completos (`apps/crm/app/api/v1/webhooks/in/[token]/route.ts:116-138`, `apps/crm/app/api/v1/webhooks/waha/[token]/route.ts:140-161`, `apps/crm/app/api/v1/webhooks/meta/[token]/route.ts:76-105`). Persistir hash/allowlist redigida; não guardar assinatura, segredo ou PII desnecessário.
4. `HIGH`: idempotência é parcial quando `external_id` falta. Exigir identificador provider/derivar chave estável e reservar atomicamente antes do side effect, tenant-aware.
5. `HIGH`: atualização temporal existente não compara precedência (`supabase/migrations/20260706210000_0027_whatsapp_conversation_unification.sql:233-253`). Usar monotonicidade (`GREATEST`/versão) e testar eventos atrasados.
6. `MEDIUM`: falhas downstream retornam sucesso HTTP em algumas rotas sem prova de persistência durable/reprocessável. Para checkout, indisponibilidade do provider ou persistência deve manter `DENY`.

## Limites da prova

`PASS LOCAL` aplica-se somente aos testes unitários provider-free deste branch. Stripe CLI/MCP autenticado, Products/Prices, webhook real, provider, deploy, schema/RLS e produção permanecem `NOT_PROVEN`. Nenhuma operação manual de Products/Prices foi executada.
