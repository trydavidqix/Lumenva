#!/usr/bin/env bash
# Install PostgreSQL 17 and matching pgvector directly on an Ubuntu CI runner.
# Uses the PostgreSQL Global Development Group's signed APT repository.
set -euo pipefail

. /etc/os-release
case "${ID:-}:${VERSION_CODENAME:-}" in
  ubuntu:noble) ;;
  *) echo "FATAL: CI nativo fixado em Ubuntu 24.04 (noble)." >&2; exit 1 ;;
esac

sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends ca-certificates curl
sudo install -d -m 0755 /usr/share/postgresql-common/pgdg
sudo curl --fail --silent --show-error --location \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  --output /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
printf 'Types: deb\nURIs: https://apt.postgresql.org/pub/repos/apt\nSuites: noble-pgdg\nComponents: main\nSigned-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc\n' \
  | sudo tee /etc/apt/sources.list.d/pgdg.sources >/dev/null
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
  postgresql-17 postgresql-client-17 postgresql-17-pgvector

test -x /usr/lib/postgresql/17/bin/initdb
test -x /usr/lib/postgresql/17/bin/pg_ctl
test -x /usr/lib/postgresql/17/bin/psql
test -f /usr/share/postgresql/17/extension/vector.control
if [ -n "${GITHUB_PATH:-}" ]; then
  echo /usr/lib/postgresql/17/bin >> "$GITHUB_PATH"
else
  echo 'Adicione /usr/lib/postgresql/17/bin ao PATH antes de pnpm test:db.'
fi
echo "PostgreSQL 17 + pgvector nativos disponíveis."
