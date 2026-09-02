-- Phase 13: Follow-up System Analytics RPC
-- Returns enrollment stats by organization for dashboard

create or replace function public.get_followup_enrollment_stats(p_org_id uuid)
returns table(
  total_enrollments bigint,
  active_enrollments bigint,
  converted_enrollments bigint,
  replied_enrollments bigint,
  exhausted_enrollments bigint,
  success_rate numeric,
  silence_sweep_rate numeric,
  daily_outcomes jsonb
)
language sql
security definer
stable
set search_path = public
as $$
with enrollment_summary as (
  select
    count(*) as total,
    sum(case when status = 'active' then 1 else 0 end) as active_count,
    sum(case when outcome = 'converted' then 1 else 0 end) as converted_count,
    sum(case when outcome = 'replied' then 1 else 0 end) as replied_count,
    sum(case when outcome = 'exhausted' then 1 else 0 end) as exhausted_count
  from public.followup_enrollments
  where organization_id = p_org_id
    and created_at > now() - interval '30 days'
),
daily_stats as (
  select
    date(created_at at time zone 'UTC')::text as date_str,
    sum(case when outcome = 'converted' then 1 else 0 end) as converted,
    sum(case when outcome = 'replied' then 1 else 0 end) as replied,
    sum(case when outcome = 'exhausted' then 1 else 0 end) as exhausted
  from public.followup_enrollments
  where organization_id = p_org_id
    and created_at > now() - interval '7 days'
  group by date(created_at at time zone 'UTC')
  order by date_str desc
  limit 7
)
select
  coalesce(es.total, 0)::bigint,
  coalesce(es.active_count, 0)::bigint,
  coalesce(es.converted_count, 0)::bigint,
  coalesce(es.replied_count, 0)::bigint,
  coalesce(es.exhausted_count, 0)::bigint,
  case
    when coalesce(es.total, 0) = 0 then 0::numeric
    else ((es.converted_count + es.replied_count)::numeric / es.total::numeric)
  end,
  case
    when coalesce(es.active_count, 0) = 0 then 0::numeric
    else (es.active_count::numeric / es.total::numeric)
  end,
  jsonb_agg(jsonb_build_object(
    'date', ds.date_str,
    'converted', ds.converted,
    'replied', ds.replied,
    'exhausted', ds.exhausted
  ) order by ds.date_str)
from enrollment_summary es
cross join daily_stats ds;
$$;

revoke execute on function public.get_followup_enrollment_stats(uuid) from public, anon;
grant execute on function public.get_followup_enrollment_stats(uuid) to authenticated;
