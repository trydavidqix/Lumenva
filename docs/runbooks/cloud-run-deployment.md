# Retired: container-based Cloud Run deployment

The previous Cloud Run / Cloud Build instructions are **historical only**.
Cloud Run requires a container image; it is not the project's native-only
runtime target. The executable `cloudbuild.yaml` has therefore been
retired from the canonical branch. Do not invoke the old GCP trigger.

## Current native release dry-run

1. `pnpm install --frozen-lockfile && pnpm repo:check`
2. `bash tooling/scripts/package-native-crm.sh`
3. Inspect `lumenva-native-crm.tar.gz` and its `START-COMMAND.txt` (Next.js
   standalone, static files, public assets).
4. Run `node apps/crm/server.js` from the unpacked release directory,
   or the root `node server.js` variant recorded in START-COMMAND.txt.

No registry login, container daemon, production secrets, upload or deployment
is performed by this command. Before a production rollout, select a native
Node host, configure secret injection, process supervision, DB migrations,
health checks, backup, rollback and real service smoke tests. These gates are
not represented as green by package validation alone.

The deprecated runbook remains available in Git history.
