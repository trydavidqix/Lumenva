-- 0173: transactional, tenant-bound contact merge.

create or replace function public.merge_contacts(
  p_primary_id uuid,
  p_loser_ids uuid[],
  p_actor_user_id uuid,
  p_queue_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_candidates uuid[];
  v_conv record;
  v_canonical_conv uuid;
  v_count integer;
begin
  if auth.uid() is distinct from p_actor_user_id then
    raise exception 'actor mismatch';
  end if;
  if p_primary_id is null or coalesce(cardinality(p_loser_ids), 0) = 0 then
    raise exception 'invalid merge';
  end if;
  if p_primary_id = any(p_loser_ids) then
    raise exception 'primary in losers';
  end if;
  if cardinality(p_loser_ids) <> (select count(distinct id) from unnest(p_loser_ids) as id) then
    raise exception 'duplicate loser';
  end if;

  select organization_id, candidates
    into v_org, v_candidates
    from public.merge_queue
   where id = p_queue_id and status = 'pending'
   for update;
  if not found then
    raise exception 'merge queue item not found';
  end if;
  if not public.fn_role_at_least(v_org, 'manager') then
    raise exception 'forbidden_role';
  end if;
  if not (p_primary_id = any(v_candidates) and p_loser_ids <@ v_candidates) then
    raise exception 'contact not in queue';
  end if;

  perform 1
    from public.contacts
   where organization_id = v_org
     and id = any(array_append(p_loser_ids, p_primary_id))
   for update;
  select count(*) into v_count
    from public.contacts
   where organization_id = v_org
     and id = any(array_append(p_loser_ids, p_primary_id));
  if v_count <> cardinality(p_loser_ids) + 1 then
    raise exception 'cross tenant or missing contact';
  end if;
  if exists (
    select 1 from public.contacts
     where organization_id = v_org
       and id = any(array_append(p_loser_ids, p_primary_id))
       and (is_anonymized or is_merged_into is not null)
  ) then
    raise exception 'contact not mergeable';
  end if;

  -- Preserve the one-to-one conversation invariant before changing contact_id.
  for v_conv in
    select id, channel_session_id, is_group, group_chat_id
      from public.conversations
     where organization_id = v_org and contact_id = any(p_loser_ids)
     order by id
     for update
  loop
    select id into v_canonical_conv
      from public.conversations
     where organization_id = v_org
       and contact_id = p_primary_id
       and channel_session_id = v_conv.channel_session_id
       and is_group = v_conv.is_group
       and group_chat_id is not distinct from v_conv.group_chat_id
     limit 1
     for update;
    if v_canonical_conv is not null then
      update public.messages set conversation_id = v_canonical_conv
       where organization_id = v_org and conversation_id = v_conv.id;
      update public.ai_agent_runs set conversation_id = v_canonical_conv
       where organization_id = v_org and conversation_id = v_conv.id;
      update public.ai_invocations set conversation_id = v_canonical_conv
       where organization_id = v_org and conversation_id = v_conv.id;
      delete from public.conversations where id = v_conv.id and organization_id = v_org;
    else
      update public.conversations
         set contact_id = p_primary_id, updated_at = now()
       where id = v_conv.id and organization_id = v_org;
    end if;
    v_canonical_conv := null;
  end loop;

  update public.messages set contact_id = p_primary_id
   where organization_id = v_org and contact_id = any(p_loser_ids);
  update public.ai_agent_runs set contact_id = p_primary_id
   where organization_id = v_org and contact_id = any(p_loser_ids);
  update public.crm_lead_activities set contact_id = p_primary_id
   where organization_id = v_org and contact_id = any(p_loser_ids);
  update public.crm_leads set contact_id = p_primary_id
   where organization_id = v_org and contact_id = any(p_loser_ids);
  update public.lgpd_requests set contact_id = p_primary_id
   where organization_id = v_org and contact_id = any(p_loser_ids);
  update public.orders set contact_id = p_primary_id
   where organization_id = v_org and contact_id = any(p_loser_ids);
  update public.crm_lead_links set target_id = p_primary_id
   where organization_id = v_org and target_kind = 'contact' and target_id = any(p_loser_ids);

  update public.contacts
     set is_merged_into = p_primary_id, merged_at = now(), updated_at = now()
   where organization_id = v_org and id = any(p_loser_ids);
  update public.merge_queue
     set status = 'resolved', resolved_by_user_id = p_actor_user_id,
         resolved_at = now(), resolution = jsonb_build_object(
           'primary_id', p_primary_id, 'loser_ids', p_loser_ids)
   where id = p_queue_id and organization_id = v_org and status = 'pending';

  return jsonb_build_object('organization_id', v_org, 'primary_id', p_primary_id, 'loser_ids', p_loser_ids);
end;
$$;

revoke all on function public.merge_contacts(uuid, uuid[], uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_contacts(uuid, uuid[], uuid, uuid) to authenticated, service_role;
