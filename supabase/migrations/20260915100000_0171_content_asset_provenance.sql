-- Stage 15: make creative asset provenance explicit without breaking old assets.
alter table if exists public.content_assets
  add column if not exists license text,
  add column if not exists provenance jsonb;

comment on column public.content_assets.license is 'Human-readable license identifier; nullable for legacy assets.';
comment on column public.content_assets.provenance is 'Validated source URL/attribution/license evidence; nullable for legacy assets.';
