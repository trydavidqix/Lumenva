#!/usr/bin/env bash
# gov-loop G1-02 — baseline install+update gate + RLS isolation invariants.
#
# Sobe um Postgres 17 efêmero (Docker quando disponível, nativo via
# initdb/pg_ctl caso contrário — ver detecção de ENGINE abaixo), aplica
# supabase/baseline.sql em modo install (ON_ERROR_STOP=1 — qualquer statement
# falhando derruba o run), re-aplica em modo update (sem a flag — idempotência)
# e roda a suíte vitest de invariantes (tests/invariants/**). O Postgres é
# SEMPRE derrubado no EXIT (sucesso ou falha), nos dois engines.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE="$ROOT/supabase/baseline.sql"
PORT="${TEST_DB_PORT:-54329}"
CONTAINER="deskcomm-test-db-$$"
IMAGE="pgvector/pgvector:pg17"

[ -f "$BASELINE" ] || { echo "FATAL: $BASELINE não encontrado" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Engine: docker (padrão quando o daemon responde) ou native (Postgres local
# via Homebrew, sem depender do Docker CLI). Force com TEST_DB_ENGINE=docker|native.
# ---------------------------------------------------------------------------
ENGINE="${TEST_DB_ENGINE:-auto}"
if [ "$ENGINE" = auto ]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    ENGINE=docker
  else
    ENGINE=native
  fi
fi
echo "==> engine: $ENGINE"

PG_BIN=""
PGDATA=""
if [ "$ENGINE" = native ]; then
  if command -v initdb >/dev/null 2>&1; then
    PG_BIN="$(dirname "$(command -v initdb)")"
  else
    for cand in /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin; do
      [ -x "$cand/initdb" ] && { PG_BIN="$cand"; break; }
    done
  fi
  [ -n "$PG_BIN" ] || {
    echo "FATAL: modo native precisa de postgresql@17 (initdb/pg_ctl/psql) no PATH." >&2
    echo "       brew install postgresql@17 pgvector" >&2
    exit 1
  }
  SHAREDIR="$("$PG_BIN/pg_config" --sharedir 2>/dev/null || true)"
  if [ -z "$SHAREDIR" ] || [ ! -f "$SHAREDIR/extension/vector.control" ]; then
    echo "FATAL: extensão pgvector não encontrada para este postgresql@17." >&2
    echo "       brew install pgvector (garanta que aponta pro mesmo postgresql@17)" >&2
    exit 1
  fi
fi

cleanup() {
  if [ "$ENGINE" = docker ]; then
    echo "==> teardown: removendo container $CONTAINER"
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  elif [ -n "$PGDATA" ]; then
    echo "==> teardown: parando postgres nativo e removendo $PGDATA"
    "$PG_BIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$PGDATA"
  fi
}
trap cleanup EXIT

if [ "$ENGINE" = docker ]; then
  echo "==> subindo $IMAGE como $CONTAINER (porta local $PORT)"
  docker run -d --rm --name "$CONTAINER" \
    -p "127.0.0.1:${PORT}:5432" \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=postgres \
    "$IMAGE" >/dev/null
  run_psql() { docker exec -i "$CONTAINER" psql -U postgres -d postgres "$@"; }
else
  # LC_ALL=C evita "postmaster became multithreaded during startup" no macOS
  # (Homebrew's own install caveat recomenda isso — CoreFoundation vira
  # multithread ao resolver locale de sistema durante o bootstrap do postgres).
  export LC_ALL=C
  PGDATA="$(mktemp -d "${TMPDIR:-/tmp}/deskcomm-test-pgdata.XXXXXX")"
  echo "==> subindo postgres nativo ($PG_BIN) em $PGDATA (porta local $PORT)"
  "$PG_BIN/initdb" -D "$PGDATA" -U postgres -A trust --locale=C -E UTF8 -N >/dev/null
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "port = $PORT"
    # UTC pra bater com o container Docker (a imagem pgvector roda em UTC por
    # default) — sem isso, timestamptz sai com o offset do sistema local
    # (ex.: +01 em Lisboa no horário de verão) e testes que comparam a saída
    # crua do psql contra "+00" quebram sem nenhuma relação com o schema.
    echo "timezone = 'UTC'"
  } >> "$PGDATA/postgresql.conf"
  "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" -w start >/dev/null
  run_psql() {
    PGPASSWORD=postgres "$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres "$@"
  }
fi

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
if [ "$ENGINE" = docker ]; then
  export TEST_DB_CONTAINER="$CONTAINER"
else
  export TEST_DB_CONTAINER="native:$PORT"
fi
export TEST_DB_ENGINE="$ENGINE"
export TEST_DB_PORT="$PORT"
vitest run --config vitest.db.config.ts "$@"

echo "==> test:db verde"
