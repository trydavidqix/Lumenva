-- Consent-bearing publication is committed only while the consent row is locked.
-- The function is additive and depends on Wave 11 public.contact_consents.
create or replace function public.fn_publish_content_if_consent(
  p_organization_id text,
  p_content_item_id text,
  p_title text,
  p_body jsonb,
  p_consent_ids text[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  consent_row record;
  expected_count integer;
begin
  expected_count := coalesce(array_length(p_consent_ids, 1), 0);
  if expected_count = 0 then
    raise exception 'publication_consent_required' using errcode = 'P0001';
  end if;

  for consent_row in
    select consent_id, organization_id, status, granted_at, revoked_at, retention_until
      from public.contact_consents
     where organization_id = p_organization_id
       and consent_id = any(p_consent_ids)
     for update
  loop
    if consent_row.status <> 'GRANTED'
       or (consent_row.granted_at is not null and consent_row.granted_at > now())
       or (consent_row.revoked_at is not null and consent_row.revoked_at <= now())
       or (consent_row.retention_until is not null and consent_row.retention_until <= now()) then
      raise exception 'publication_consent_required' using errcode = 'P0001';
    end if;
  end loop;

  if (select count(*) from public.contact_consents where organization_id = p_organization_id and consent_id = any(p_consent_ids)) <> expected_count then
    raise exception 'publication_consent_required' using errcode = 'P0001';
  end if;

  update public.content_items
     set title = p_title, body = p_body, status = 'scheduled'
   where organization_id = p_organization_id and id = p_content_item_id;
  if not found then
    raise exception 'publication_not_publishable' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.fn_publish_content_if_consent(text, text, text, jsonb, text[]) from public;
grant execute on function public.fn_publish_content_if_consent(text, text, text, jsonb, text[]) to authenticated, service_role;
