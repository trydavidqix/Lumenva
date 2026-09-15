# Runbook — Segurança e operações Lumenva

Este procedimento é read-only até ao ponto explicitamente aprovado pelo dono.
Nunca fazer merge, push, rebase ou integração em `main` durante a validação.

## Verificação antes de release

```bash
git fetch origin --prune
git rev-parse origin/main
git status --short --branch
git diff --check
pnpm install --frozen-lockfile
pnpm --filter lumenva-crm typecheck
pnpm --filter lumenva-crm lint
pnpm --filter lumenva-crm lint:channels
pnpm --filter lumenva-crm test:unit
pnpm --filter lumenva-crm test:db
pnpm --filter lumenva-website typecheck
pnpm --filter lumenva-website lint
pnpm --filter lumenva-website test
```

Se a rede local não resolver o registry, executar os mesmos comandos no Codex Cloud.
Não imprimir `.env`, tokens, cookies ou payloads de webhook.

## Scan rápido de segredos e telemetria

```bash
rg -n 'console\.log|Authorization: Bearer|api[_-]?key\s*[:=]|secret\s*[:=]' apps/crm .github
pnpm --filter lumenva-crm test:unit -- apps/crm/lib/sentry/scrub.test.ts apps/crm/lib/channels/gateway/security.test.ts
```

Achados em testes/fixtures e mensagens sanitizadas devem ser classificados antes de
qualquer alteração. A telemetria deve passar por `lib/sentry/scrub.ts`; logs de gateway
usam `sanitizeGatewayLogContext`.

## Deploy e rollback

Executar o deploy apenas com autorização do dono e seguindo [`deploy.md`](./deploy.md).
Antes de promover, guardar o SHA exato e o último deployment verde. Em falha, reativar
o deployment verde conhecido e repetir o smoke:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<DOMAIN>/
curl -s -o /dev/null -w '%{http_code}\n' https://<DOMAIN>/api/v1/health
```

Esperar `307` na raiz protegida e `200` no health público. Não apagar volumes,
migrations, secrets ou histórico para fazer rollback.
