-- J2 EPD/DPO assessment. Additive-only; dpo_email remains available for dual-read.
alter table public.organizations
  add column if not exists dpo_required boolean,
  add column if not exists dpo_assessment jsonb,
  add column if not exists dpo_assessed_at timestamptz,
  add column if not exists dpo_assessed_by uuid references auth.users(id),
  add column if not exists dpo_public_contact text,
  add column if not exists dpo_responsibilities text,
  add column if not exists dpo_cnpd_url text;

comment on column public.organizations.dpo_required is 'RGPD arts. 37-39 assessment result; NULL means not assessed.';
comment on column public.organizations.dpo_assessment is 'Documented criteria and assessment history; no inference from legacy dpo_email.';
comment on column public.organizations.dpo_public_contact is 'Public EPD contact for privacy notices when applicable.';
comment on column public.organizations.dpo_cnpd_url is 'CNPD notification/workflow reference when applicable.';
