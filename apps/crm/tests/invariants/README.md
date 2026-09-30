# Invariantes PostgreSQL / RLS — sem Docker

Execute `pnpm test:db` a partir da raiz. Requisitos: PostgreSQL **17 nativo**
(`initdb`, `pg_ctl`, `psql`) e extensão **pgvector** instalada para a mesma
versão. No macOS: `brew install postgresql@17 pgvector`. No CI Linux, instalar
`postgresql-17 postgresql-client-17 postgresql-17-pgvector` do repositório
oficial PGDG.

O script `apps/crm/scripts/test-db.sh` cria um cluster temporário isolado em
`127.0.0.1:54329`, sem contêiner ou acesso ao banco de produção. Aplica os
roles e stubs mínimos de Auth/Storage, mais as extensões necessárias ao
`infra/supabase/baseline.sql`. Executa instalação estrita (ON_ERROR_STOP=1),
reaplicação tolerante documentada e todos os testes em `tests/invariants/**`.
A limpeza do cluster ocorre por `trap`, inclusive em caso de erro.

`TEST_DB_CONTAINER=native:<porta>` permanece somente como marcador de
compatibilidade para specs existentes; não designa nem acessa contêiner.
`TEST_DB_ENGINE=docker` é explicitamente rejeitado. Fixtures e identificadores
são sintéticos. As chaves de `vitest.db.config.ts` são placeholders e nunca
autenticam contra um serviço externo.

**Critério de aprovação:** baseline instala; isolamento entre organizações,
RLS e ACL passam contra PostgreSQL real; o processo encerra e elimina os
dados temporários. Não confundir este gate com E2E de Auth/Storage/Supabase
gerenciados, que requerem projeto isolado e credenciais válidas.
