-- 0157 — isenção de pacing por contacto, sem alterar knobs por sessão.
alter table public.contacts
  add column if not exists pacing_exempt boolean not null default false;

comment on column public.contacts.pacing_exempt is
  'Isenção explícita deste contacto aos gates de pacing/janela; STOP e LGPD continuam ativos.';
