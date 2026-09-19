---
title: Lumenva identity compatibility matrix
audited_at: 2026-09-15T04:05:00+01:00
status: active-contract
---

# Lumenva — identity compatibility matrix

## Decision

`Lumenva` is the public brand. `CRM` remains the functional category and domain vocabulary. `DeskcommCRM` and `deskcomm-crm` remain legacy technical identifiers where they are part of an existing deployment, database, cookie, header, image, or external URL contract.

The rename is additive and non-breaking. No database object, Docker image, cookie, signature header, environment variable, URL, or persisted identifier is removed solely to improve branding.

## Matrix

| Surface | Canonical new identity | Legacy identity | Compatibility rule | Status/evidence |
|---|---|---|---|---|
| Public product name | `Lumenva` / `Lumenva CRM` | `DeskcommCRM` | New copy may use Lumenva; historical technical references remain meaningful. | package descriptions and public docs inspected |
| CRM package | `lumenva-crm` | `deskcomm-crm` | Keep package private and use the new name in workspace filters; do not publish or remove a legacy package alias without owner approval. | `apps/crm/package.json`; `rename-r5-compat.test.ts` |
| Website package | `lumenva-website` | legacy website names | Keep the website package independent from CRM package naming. | `apps/site/package.json` |
| HTTP signature | `x-lumenva-signature` | `x-deskcomm-signature` | Read the new header first, then fallback to the legacy header. | `apps/crm/lib/http/compat.ts`; unit test |
| Impersonation cookie | `lumenva-impersonate` | `deskcomm-impersonate` | Read the new cookie first; accept legacy cookie; remove legacy only through an explicit migration. | `apps/crm/lib/impersonate/names.ts`; unit test |
| Supabase auth cookies | `lumenva-auth-token*` | `deskcomm-auth-token*` | Normalize legacy cookie chunks to the new name only when the new chunk is absent. | `apps/crm/lib/supabase/cookie-compat.ts`; unit test |
| Database tables/schema | functional names such as `crm_leads` | same | Keep `crm_*`; this is domain vocabulary, not public branding. Never rename through search/replace or drop/create. | Supabase baseline and migrations |
| Docker image | future Lumenva tag | `ghcr.io/melgarafael/deskcommcrm:latest` | Keep legacy pull path as an alias until pull, upgrade, and rollback are proven and owner approves removal. | compose and deploy runbook |
| Compose project/volumes | existing production names | `deskcommcrm-*` volumes | Preserve named volumes and project names during upgrades. | `docker-compose.prod.yml`; deploy runbook |
| GitHub URLs | repository currently resolved by remote | `melgarafael/DeskcommCRM` URLs | Update only when redirect/consumer impact is proven; preserve working clone, issue, security, and installer links during transition. | `.github/ISSUE_TEMPLATE/*`; README/docs |
| Domains/env/secrets | current Lumenva domains | legacy domains and keys | Do not rotate or rename operational values as a cosmetic change. Add aliases and migrate consumers first. | env examples and deployment docs |

## Forbidden changes without an owner decision

- Renaming `crm_*` tables, functions, constraints, indexes, RLS policies, or generated types.
- Removing `deskcomm-*` cookies, headers, image tags, volumes, environment variables, or URLs.
- Changing Supabase project identifiers, production domains, provider accounts, or deployment topology.
- Deleting remote branches or rewriting history to erase legacy names.

## Verification contract

Run locally when dependencies are available:

```bash
pnpm --filter lumenva-crm test:unit -- apps/crm/tests/unit/rename-r5-compat.test.ts apps/crm/tests/unit/lumenva-identity-contract.test.ts
pnpm --filter lumenva-crm typecheck
pnpm --filter lumenva-crm lint
```

Codex Cloud must run the same commands from a clean checkout if the local sandbox cannot resolve npm packages. Static checks for this document are `git diff --check` and the required-token assertions in the companion unit test.
