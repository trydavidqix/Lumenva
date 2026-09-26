-- Content OS learning events need a tenant-scoped idempotency key so decay
-- detection can be retried safely without multiplying refresh events.
alter table public.content_learning_events
  add column if not exists idempotency_key text;

create unique index if not exists content_learning_events_idempotency_idx
  on public.content_learning_events (organization_id, idempotency_key)
  where idempotency_key is not null;
