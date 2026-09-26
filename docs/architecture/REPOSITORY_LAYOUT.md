# Lumenva repository layout

Status: canonical layout for the `refactor/lumenva-clean-architecture` migration.

## Ownership

| Path | Owns |
|---|---|
| `apps/` | Deployable applications and workers: CRM, website, social surfaces, voice worker, and video-composer documentation. |
| `packages/` | Shared/importable code, grouped by core, integrations, platform, observability, UI, and config. |
| `infra/` | Supabase schema/config, Docker assets, and deployment stacks such as n8n and Asterisk. |
| `knowledge/` | Lumenva business knowledge and its Obsidian vault configuration. |
| `docs/` | Human-readable product, engineering, architecture, audit, research, and historical material. |
| `evidence/` | Release, migration, security, test, and incident evidence. |
| `tooling/` | Repository scripts, Git hooks, and the existing agent loop. |
| `tests/` | Cross-application tests; app/package-specific tests remain beside their owner. |
| `config/` | Shared registries and configuration, not application-specific settings. |

`apps/crm` remains the existing CRM application and is not being decomposed into
new micro-packages as part of this path-only reorganization. Existing package
names remain stable while their directories move under `packages/core/`.

## Compatibility exceptions

- Root Dockerfiles, Compose manifests, `cloudbuild.yaml`, and `.dockerignore`
  remain at the repository root because their current build/deploy entry points
  use the repository root as Docker context. The former root `docker/` directory
  now lives at `infra/docker/`.
- Root `.obsidian/` is retained as the repository-level vault configuration.
  The business knowledge vault and its separate configuration now live in
  `knowledge/.obsidian/`; neither configuration is overwritten or merged.
- Root `lib` remains the existing tracked compatibility link to the CRM's
  library. CRM imports and tooling still rely on that established path.
- `apps/video-composer/` currently contains documentation only. No executable
  package is fabricated until implementation exists.
- Historical references in archived plans, audits, evidence, and checkpoint
  reports may name their original paths. Dated files under `docs/handoffs/`,
  `docs/evidence/`, `docs/phase-*-status.md`, and the 2026-09-09 monorepo plan
  are historical snapshots; paths in them describe the layout at the time.
  This document and current operational runbooks are authoritative. Active
  code, workflows, hooks, and current documentation must use the canonical
  paths above.

## Migration rules

1. `apps/` contains independently runnable/deployable surfaces; reusable code
   belongs in `packages/`.
2. Database migrations and the canonical schema baseline live under
   `infra/supabase/`.
3. Git hooks and the agent loop live under `tooling/`; loop state and evidence
   retain their existing tracked/ignored behavior.
4. Move tracked files with `git mv`, preserve history, and update path consumers
   before declaring a batch complete.
5. Do not remove code based only on unused-file reports. Classify findings and
   retain uncertain files until ownership and regeneration are proven.
