---
paths:
  - "apps/crm/**"
  - "infra/supabase/**"
---

# Segurança de identidade do CRM

Para auth/RBAC exatos, consulte PRD/Spec 01. As fontes canônicas definem o contrato; esta rule resume invariantes operacionais.

## Auth e identidade

- Backend usa `getUser()`, nunca `getSession()` como prova de identidade.
- API key/token nunca vai em query string.
- Plaintext de bearer é mostrado uma vez na criação e não é persistido; o contrato base usa hash SHA256/prefixo conforme Spec 01.
- Cookie/session segue o contrato seguro da plataforma (`SameSite`/`HttpOnly`/`Secure` em produção).
- HMAC de webhook usa comparação timing-safe e falha fechado quando o secret necessário não existe.

## RBAC e plataforma

Roles tenant: `viewer < agent < manager < admin`. A autorização é server-side; a UI não é boundary de segurança. Um usuário pode ter roles diferentes por organização em `user_organizations`; mudança de role é auditada.

- MFA TOTP é obrigatório para `admin` e platform admin conforme PRD 01.
- Papel cross-tenant é a tabela `platform_admins`, não coluna `is_platform_admin` em `auth.users`.
- Platform admin é o único papel cross-tenant e suas ações são controladas e auditadas.
- `user_pipeline_access` fica fora do MVP enquanto PRD 01 mantiver a decisão.
- Service role bypassa RLS: resolva tenant de fonte confiável, filtre `organization_id`, preserve RBAC/ownership e registre audit da mutação relevante. Nunca confie no body do request.

## Logging

Use o logger estruturado; não deixe `console.log` em código merged. Minimize dados sensíveis na origem; não dependa só do sanitizador do Sentry. Erros e testes também não devem conter PII/secrets. Auditoria detalhada: `.claude/rules/audit-observability.md`; privacidade: `.claude/rules/lgpd.md`.

## Fontes

- `docs/prd/01-prd-platform-base.md` §3.1, §3.3, §3.4
- `docs/specs/01-spec-platform-base.md`
