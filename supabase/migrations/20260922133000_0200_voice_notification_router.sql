-- Voice/WhatsApp Notification Router — durable reminder state + escalation jobs.
-- Branch: voz. Service-role/worker paths mutate; authenticated users only read
-- their own tenant state. No medical/sensitive payload is required by this
-- schema: callers should keep reminder body generic unless product policy says
-- otherwise.

create table if not exists public.notification_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
  category text not null default 'reminder' check (category in ('reminder')),
  body text not null check (char_length(body) between 1 and 500),
  ack_token text not null check (ack_token ~ '^[A-Z0-9]{6}$'),
  status text not null default 'scheduled' check (
    status in (
      'scheduled','whatsapp_pending','whatsapp_sent','acknowledged',
      'voice_pending','voice_queued','completed','failed','canceled'
    )
  ),
  scheduled_at timestamptz not null,
  escalation_at timestamptz not null,
  whatsapp_message_id uuid null references public.messages(id) on delete set null,
  voice_call_id uuid null references public.voice_calls(id) on delete set null,
  acknowledged_at timestamptz null,
  completed_at timestamptz null,
  last_error_code text null check (last_error_code is null or char_length(last_error_code) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_requests_org_contact_fk
    foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id)
    on delete cascade,
  constraint notification_requests_escalation_order
    check (escalation_at >= scheduled_at),
  unique (organization_id, idempotency_key),
  unique (organization_id, ack_token)
);

create index if not exists notification_requests_due_idx
  on public.notification_requests (status, scheduled_at)
  where status in ('scheduled','whatsapp_pending','voice_pending');

create index if not exists notification_requests_contact_live_idx
  on public.notification_requests (organization_id, contact_id, created_at desc)
  where status not in ('completed','failed','canceled','acknowledged');

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  notification_id uuid not null references public.notification_requests(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','voice')),
  attempt smallint not null check (attempt between 1 and 10),
  status text not null check (status in ('queued','sent','delivered','acknowledged','failed','skipped')),
  external_id text null check (external_id is null or char_length(external_id) <= 256),
  error_code text null check (error_code is null or char_length(error_code) <= 120),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (notification_id, channel, attempt)
);

create index if not exists notification_delivery_attempts_org_time_idx
  on public.notification_delivery_attempts (organization_id, occurred_at desc);

alter table public.notification_requests enable row level security;
alter table public.notification_delivery_attempts enable row level security;

drop policy if exists notification_requests_select_org on public.notification_requests;
create policy notification_requests_select_org
  on public.notification_requests
  for select to authenticated
  using (organization_id in (select public.fn_user_org_ids()));

drop policy if exists notification_delivery_attempts_select_org on public.notification_delivery_attempts;
create policy notification_delivery_attempts_select_org
  on public.notification_delivery_attempts
  for select to authenticated
  using (organization_id in (select public.fn_user_org_ids()));

-- Durable execution reuses the existing agent-worker queue. A notification job
-- always has a contact lane, so it participates in the same one-running-job-per-
-- contact invariant as conversational turns.
alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check
  check (kind in (
    'inbound_turn','followup_turn','watchdog','flywheel',
    'case_reply_turn','operator_turn','notification_delivery'
  ));

alter table public.job_queue drop constraint if exists job_queue_turn_needs_contact;
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.job_queue'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%contact_id is not null%';
  if c is not null then
    execute format('alter table public.job_queue drop constraint %I', c);
  end if;
end $$;
alter table public.job_queue add constraint job_queue_turn_needs_contact
  check (
    (kind in ('inbound_turn','followup_turn','case_reply_turn','operator_turn','notification_delivery'))
    = (contact_id is not null)
  );

-- cron_jobs is only the durable timer; when due, the existing scheduler
-- enqueues notification_delivery into job_queue.
alter table public.cron_jobs drop constraint if exists cron_jobs_job_kind_check;
alter table public.cron_jobs add constraint cron_jobs_job_kind_check
  check (job_kind in (
    'inbound_turn','followup_turn','watchdog','flywheel',
    'case_reply_turn','notification_delivery'
  ));

comment on table public.notification_requests is
  'Durable notification/reminder state. Fixed scheduling routes directly to Notification Router; Maestri is not required.';
comment on table public.notification_delivery_attempts is
  'Append-oriented channel attempt ledger for WAHA/voice notification delivery; no secrets or raw provider payloads.';
