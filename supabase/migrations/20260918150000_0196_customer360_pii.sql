-- 0172: Customer 360 CPF encryption boundary.
-- Plaintext CPF never gets persisted when the key/RPC is unavailable.

create schema if not exists private;
create table if not exists private.app_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on schema private from public;
revoke all on all tables in schema private from public;

create or replace function private.fn_cpf_key()
returns text
language sql
security definer
set search_path = private, pg_temp
as $$
  select coalesce(
    nullif(current_setting('app.cpf_key', true), ''),
    (select value from private.app_secrets where name = 'cpf_encryption_key')
  );
$$;
revoke all on function private.fn_cpf_key() from public;

create or replace function public.encrypt_cpf(p_plaintext text)
returns bytea
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  k text := private.fn_cpf_key();
  digits text := regexp_replace(coalesce(p_plaintext, ''), '\D', '', 'g');
begin
  if length(digits) <> 11 then
    raise exception 'invalid CPF';
  end if;
  if k is null or length(k) < 32 then
    raise exception 'CPF encryption key unavailable';
  end if;
  return pgp_sym_encrypt(digits, k, 'cipher-algo=aes256');
end;
$$;

create or replace function public.decrypt_cpf(
  p_contact_id uuid,
  p_purpose text default null
)
returns text
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_cipher bytea;
  k text := private.fn_cpf_key();
begin
  select organization_id, cpf_encrypted
    into v_org, v_cipher
    from public.contacts
   where id = p_contact_id;

  if v_org is null then
    raise exception 'contact not found';
  end if;
  if auth.role() <> 'service_role' and not (
    exists (select 1 from public.fn_user_org_ids() o where o.organization_id = v_org)
    or public.fn_is_platform_admin()
  ) then
    raise exception 'forbidden_org';
  end if;
  if not public.fn_role_at_least(v_org, 'manager') and not public.fn_is_platform_admin() then
    raise exception 'forbidden_role';
  end if;
  if v_cipher is null then
    return null;
  end if;
  if k is null or length(k) < 32 then
    raise exception 'CPF encryption key unavailable';
  end if;

  insert into public.api_audit_log
    (organization_id, action, actor_user_id, resource_type, resource_id, metadata, bypassed_rls)
  values
    (v_org, 'contact.cpf_decrypted', auth.uid(), 'contact', p_contact_id,
     jsonb_build_object('purpose', nullif(left(coalesce(p_purpose, ''), 200), '')), false);

  return pgp_sym_decrypt(v_cipher, k);
end;
$$;

revoke all on function public.encrypt_cpf(text) from public, anon, authenticated;
revoke all on function public.decrypt_cpf(uuid, text) from public, anon, authenticated;
grant execute on function public.encrypt_cpf(text) to service_role;
grant execute on function public.decrypt_cpf(uuid, text) to service_role;
