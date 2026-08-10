# API Contract & Idempotency — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence. Para payload/schema exato, `docs/specs/` vence este resumo.

## Contrato `/api/v1/`

- Versionamento é por path: `/api/v1/`, depois `/api/v2/` quando necessário.
- Request/response JSON usam `snake_case`. **Isto é contrato da API, não convenção de nome de arquivo TypeScript.**
- IDs públicos usam UUID v4 quando o contrato do recurso não disser diferente.
- Datas são ISO-8601 UTC.
- Dinheiro é inteiro em `_cents` + `currency` ISO-4217.
- Sucesso usa `ok()`/wrapper `{ data, meta? }` de `lib/api/wrappers.ts`.
- Erro usa `fail()`/wrapper `{ error: { code, message, details? } }` e códigos de `lib/api/errors.ts`.
- Paginação por default usa cursor opaco protegido por HMAC quando a superfície segue o contrato base.

## Auth na borda

- Frontend autenticado usa cookie/session validada server-side.
- Server-to-server usa `Authorization: Bearer tok_...` conforme a superfície.
- API key/token **nunca** vai em query string. Se recebido por query numa superfície que segue este contrato, rejeite em vez de aceitar silenciosamente.
- Plaintext de bearer é mostrado uma vez na criação e não é persistido como segredo recuperável; o contrato base guarda hash SHA256/prefixo conforme a implementação canônica.

## Idempotência

POSTs de criação que seguem o contrato base aceitam:

```http
Idempotency-Key: <uuid>
```

Contrato documentado na Plataforma Base:

- TTL: 24h;
- mesma key + mesmo payload: devolver semanticamente a mesma operação sem duplicar efeito;
- mesma key + payload diferente: `409 idempotency_conflict`;
- não implemente idempotência apenas no frontend: side effect precisa ser protegido no servidor/storage apropriado.

Eventos externos e mensagens usam também a chave natural tenant-aware definida pelo domínio, por exemplo `unique (organization_id, external_id)` e captura de `23505` no inbound WAHA.

## Rate limit

Quando a rota está sob o contrato base de rate limit:

- Upstash Redis sliding window é o mecanismo documentado;
- resposta 429 inclui `Retry-After`;
- exponha `X-RateLimit-*` conforme os helpers/contrato vigente;
- não invente limite numérico novo: use o configurado pela superfície/tenant.

## Request correlation

`X-Request-Id` acompanha a response nas superfícies cobertas e correlaciona logs/audit quando o contrato exigir. Não gere um segundo identificador incompatível se o middleware/helper já fornece o canônico.

## CORS e tenant

- CORS usa allowlist explícita quando aplicável; nunca `*` em superfície autenticada/tenant-aware por conveniência.
- Tenant não é escolhido pelo body do request. Resolução de organização segue `.claude/rules/multi-tenancy.md`.

## Side effects

- Trigger Postgres nunca faz HTTP.
- Receiver/webhook valida autenticação/assinatura antes de confiar no payload.
- Side effect assíncrono deve ter idempotência e ownership de retry claros.

## Fontes

- `docs/prd/01-prd-platform-base.md` §3.8
- `docs/specs/01-spec-platform-base.md`
- `docs/business-rules/00-business-rules-catalog.md`
