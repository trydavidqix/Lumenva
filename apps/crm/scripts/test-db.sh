#!/usr/bin/env bash
# gov-loop G1-02 — baseline install+update gate + RLS isolation invariants.
# PostgreSQL 17 + pgvector run as an ephemeral NATIVE process. No container daemon.
# Applies infra/supabase/baseline.sql in strict install mode and the documented
# tolerant update mode; always stops and removes the test cluster on EXIT.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
BASELINE="$ROOT/infra/supabase/baseline.sql"

if ! command -v vitest >/dev/null 2>&1; then
  echo "ERRO: vitest não está no PATH — a suíte de invariantes não rodaria." >&2
  echo "      Use pnpm test:db para incluir node_modules/.bin no PATH." >&2
  exit 1
fi

PORT="${TEST_DB_PORT:-54329}"
ENGINE="${TEST_DB_ENGINE:-native}"
[ "$ENGINE" = native ] || {
  echo "FATAL: somente TEST_DB_ENGINE=native é suportado (recebido: $ENGINE)." >&2
  exit 1
}
[ -f "$BASELINE" ] || { echo "FATAL: $BASELINE não encontrado" >&2; exit 1; }

PG_BIN=""
if command -v initdb >/dev/null 2>&1; then
  PG_BIN="$(dirname "$(command -v initdb)")"
else
  for cand in /usr/lib/postgresql/17/bin /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin; do
    [ -x "$cand/initdb" ] && { PG_BIN="$cand"; break; }
  done
fi
[ -n "$PG_BIN" ] && [ -x "$PG_BIN/pg_ctl" ] && [ -x "$PG_BIN/psql" ] || {
  echo "FATAL: PostgreSQL 17 nativo (initdb, pg_ctl, psql) é obrigatório." >&2
  echo "       Linux/CI: postgresql-17 + postgresql-17-pgvector; macOS: brew install postgresql@17 pgvector." >&2
  exit 1
}
export PATH="$PG_BIN:$PATH"
PG_MAJOR="$("$PG_BIN/postgres" --version | sed -E 's/^.* ([0-9]+)\..*$/\1/')"
[ "$PG_MAJOR" = 17 ] || {
  echo "FATAL: PostgreSQL 17 exigido; encontrado major=$PG_MAJOR ($PG_BIN)." >&2
  exit 1
}
if [ -x "$PG_BIN/pg_config" ]; then
  SHAREDIR="$("$PG_BIN/pg_config" --sharedir)"
else
  SHAREDIR="/usr/share/postgresql/17"
fi
[ -f "$SHAREDIR/extension/vector.control" ] || {
  echo "FATAL: pgvector não encontrado para PostgreSQL 17 ($SHAREDIR)." >&2
  exit 1
}

PGDATA=""
cleanup() {
  if [ -n "$PGDATA" ]; then
    "$PG_BIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$PGDATA"
  fi
}
trap cleanup EXIT

export LC_ALL=C
PGDATA="$(mktemp -d "${TMPDIR:-/tmp}/lumenva-test-pgdata.XXXXXX")"
echo "==> PostgreSQL 17 nativo ($PG_BIN), porta 127.0.0.1:$PORT"
"$PG_BIN/initdb" -D "$PGDATA" -U postgres -A trust --locale=C -E UTF8 -N >/dev/null
{
  echo "listen_addresses = '127.0.0.1'"
  echo "port = $PORT"
  echo "timezone = 'UTC'"
} >> "$PGDATA/postgresql.conf"
"$PG_BIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" -w start >/dev/null
run_psql() {
  PGPASSWORD=postgres "$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres "$@"
}

# Espera o servidor DEFINITIVO (o initdb sobe um temporário só em socket;
# testar via TCP 127.0.0.1 evita o falso-ready da fase de init).
ready=0
for _ in $(seq 1 60); do
  if run_psql -h 127.0.0.1 -c "select 1" >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 1
done
[ "$ready" = 1 ] || { echo "FATAL: postgres não ficou pronto em 60s" >&2; exit 1; }

psql_install() {
  run_psql -v ON_ERROR_STOP=1 -q -f - "$@"
}

echo "==> prelude: stubs mínimos do Supabase (roles, auth.uid(), extensions)"
# Um Postgres cru não tem os roles/schemas do Supabase que o baseline (pg_dump) supõe.
# Criamos os stubs mínimos AQUI — nunca editar o baseline.sql pra isso.
psql_install <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

-- Match Supabase's default table ACL before applying the baseline. Without this,
-- privilege invariants can pass because fresh tables start more restricted than
-- the real Supabase project.
alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant all on tables to authenticated;
alter default privileges for role postgres in schema public grant all on tables to service_role;

create schema if not exists auth;
create schema if not exists extensions;

-- O baseline referencia extensions.uuid_generate_v4/gen_random_bytes e os tipos
-- public.vector/public.citext + gin_trgm_ops, mas não cria as extensões (pg_dump).
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema public;
create extension if not exists citext with schema public;
create extension if not exists pg_trgm with schema public;

-- Stubs de storage (o apêndice do baseline cria buckets + policies em storage.objects).
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Stub de auth.users (FKs do baseline apontam pra cá).
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- Stub de auth.uid() lendo o claim `sub` de request.jwt.claims (mesmo contrato
-- do Supabase; os testes simulam o JWT via set_config).
create or replace function auth.uid() returns uuid
  language sql stable
  as $fn$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $fn$;

grant usage on schema auth, extensions, storage to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
SQL

echo "==> modo INSTALL: aplicando baseline.sql com ON_ERROR_STOP=1"
psql_install < "$BASELINE"
echo "    ✓ install ok"

echo "==> modo UPDATE: re-aplicando baseline.sql sem ON_ERROR_STOP (idempotência)"
run_psql -q -f - < "$BASELINE" >/dev/null
echo "    ✓ update ok (re-apply terminou; erros tolerados por contrato)"

echo "==> invariantes: vitest (tests/invariants)"
# Compatibility marker consumed by existing SQL invariants; never a container.
export TEST_DB_CONTAINER="native:$PORT"
export TEST_DB_ENGINE="native"
export TEST_DB_PORT="$PORT"
vitest run --config vitest.db.config.ts "$@"

echo "==> test:db verde"
