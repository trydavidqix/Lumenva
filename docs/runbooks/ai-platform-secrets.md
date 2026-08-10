# AI Platform — operating model for secrets

## Boundaries

Platform/runtime secrets remain environment variables validated by `lib/env.ts`: Supabase service access, internal cron authentication, encryption keys, WAHA credentials, Redis access, provider keys, Sentry and LGPD signing material. They are injected only at runtime and never committed, logged, placed in fixtures, projections, telemetry or Golden Dataset cases.

Tenant BYOK remains in `ai_provider_credentials`, encrypted in PostgreSQL by the existing `AI_CRED_AES_KEY` flow. It is not moved to Infisical, Mem0, Graphiti, LangSmith or any external provider.

## Controlled runtime injection

For a controlled local or operator runtime, inject a pre-existing Infisical project with:

```text
infisical run -- <command>
```

Do not place an Infisical access token in the repository, `.env.example`, logs or task definitions. This Phase 0 change does not install Infisical, create a project, enable a provider, configure a production auto-restart, or enable watch mode.

## Break-glass

KeePassXC stores human/admin/recovery material only. Applications, workers and containers never read KeePassXC directly. Break-glass use is manual, audited by the operator and followed by credential rotation according to the affected provider's procedure.

## Rollback

Set the applicable `AI_PLATFORM_KILL_*` runtime variable to `true` to force the corresponding optional feature to `off`. Kill switches override tenant and global database flags; official CRM state remains in PostgreSQL.
