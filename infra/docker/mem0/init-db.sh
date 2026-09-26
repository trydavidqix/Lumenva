#!/bin/bash
set -e

# Cria o banco mem0_app (dados de usuário/auth/api-key do servidor Mem0),
# separado do banco padrão POSTGRES_DB usado pelo pgvector para memória.
# Reproduzido do init-db.sh oficial de mem0ai/mem0 (server/), Apache-2.0,
# commit 96d45b78 — ver docs/runbooks/mem0.md para o motivo de existir aqui
# em vez de vir junto da imagem publicada.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE mem0_app'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mem0_app')\gexec
EOSQL
