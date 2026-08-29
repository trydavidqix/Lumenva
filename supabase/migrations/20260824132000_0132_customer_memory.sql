-- 0132_customer_memory
-- Renumerado de 0124 para 0132 em 2026-08-29 (forward-fix pós-merge de voz):
-- a merge de codex/voice-media-integration trouxe este arquivo com o mesmo
-- número de 0124_ai_chunks_embedding_2048 (pré-existente). Timestamp mantido
-- — é a identidade que o Supabase CLI usa para ordem/PK — só o NNNN mudou.
-- Structured quick memory for token-efficient agent turns.
-- CRM/order state remains authoritative; this table stores a bounded projection.

-- PostgreSQL requires the referenced column set of a composite FK to be unique.
-- contacts.id is already globally unique, so this index is logically redundant;
-- it exists only to let the FK prove organization_id + contact_id together.
create unique index if not exists contacts_organization_id_id_uidx
  on public.contacts (organization_id, id);

create table if not exists public.customer_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  memory jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_memory_org_contact_unique unique (organization_id, contact_id),
  constraint customer_memory_contact_same_org_fk
    foreign key (organization_id, contact_id)
    references contacts (organization_id, id)
    on delete cascade
);

comment on table public.customer_memory is
  'Bounded structured customer-memory projection used to reduce agent context tokens. CRM/order tables remain authoritative.';

create index if not exists customer_memory_contact_idx
  on public.customer_memory (contact_id);

alter table public.customer_memory enable row level security;

drop policy if exists tenant_isolation_customer_memory on public.customer_memory;
create policy tenant_isolation_customer_memory on public.customer_memory
  for all
  using (organization_id in (select fn_user_org_ids()))
  with check (organization_id in (select fn_user_org_ids()));

revoke all on public.customer_memory from anon;
grant select, insert, update, delete on public.customer_memory to authenticated;

drop trigger if exists trg_customer_memory_audit on public.customer_memory;
create trigger trg_customer_memory_audit
  after insert or update or delete on public.customer_memory
  for each row execute function public.fn_audit_log_row();
