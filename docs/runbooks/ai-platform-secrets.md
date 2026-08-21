# AI Platform — operating model for secrets

## Boundaries

Platform/runtime secrets remain environment variables validated by `lib/env.ts`: Supabase service access, internal cron authentication, encryption keys, WAHA credentials, Redis access, provider keys, Sentry and LGPD signing material. They are injected only at runtime and never committed, logged, placed in fixtures, projections, telemetry or Golden Dataset cases.

Tenant BYOK remains in `ai_provider_credentials`, encrypted in PostgreSQL by the existing `AI_CRED_AES_KEY` flow. It is not moved to Infisical, Mem0, Graphiti, LangSmith or any external provider.

## Mem0 optional sidecar

The Phase 2 sidecar introduces two distinct secret groups:

- server-only bootstrap material (`MEM0_POSTGRES_PASSWORD`, `MEM0_JWT_SECRET`
  and the embedding-provider key required by the Mem0 OSS server);
- CRM client configuration (`MEM0_BASE_URL`, `MEM0_API_KEY`,
  `MEM0_TIMEOUT_MS`).

Keep both groups empty while the feature is `OFF`. They belong only to the
approved self-host runtime/secret manager, never to Git, browser variables,
fixtures, LangSmith traces or error text. `MEM0_API_KEY` is emitted by Mem0
after bootstrap; do not manufacture or paste a value into the CRM before the
sidecar health and namespace checks have passed. The operational sequence and
safe wipe procedure are in [`mem0.md`](mem0.md).

## Graphiti optional sidecar

The Phase 4 sidecar (Neo4j + `zepai/graphiti`) introduces its own secret
group, distinct from Mem0's and from tenant BYOK:

- `GRAPHITI_NEO4J_PASSWORD` — Neo4j `neo4j` user password, only takes effect
  on first volume init.
- `GRAPHITI_API_KEY` — shared secret between the CRM app and the sidecar
  (reflected on both sides via `lib/env.ts`).
- `GRAPHITI_LLM_API_KEY` — platform-owned credential for whichever
  OpenAI-compatible LLM/embedder provider backs the sidecar (never a tenant
  BYOK key from `ai_provider_credentials`).
- `GRAPHITI_LLM_BASE_URL` / `GRAPHITI_LLM_MODEL` / `GRAPHITI_EMBEDDER_MODEL`
  — provider-swap config; the provider itself is not sensitive, but treat
  the triple as one unit with the API key above.

Same rule as Mem0: these live only in the approved self-host runtime/secret
manager, never in Git, `.env.example` values, fixtures or logs. Full detail
and the 🟡 known-drift note (VPS `.env` currently ahead of Infisical for
this group) are in [`graphiti.md`](graphiti.md#segredos-antes-do-bootstrap).

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
