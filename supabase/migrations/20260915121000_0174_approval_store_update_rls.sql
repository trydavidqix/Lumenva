-- Approval decisions are privileged state transitions; tenant membership alone
-- must not grant a user permission to approve or execute a request.
drop policy if exists approval_requests_update on public.approval_requests;
create policy approval_requests_update
  on public.approval_requests
  for update to authenticated
  using (
    public.fn_is_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager')
    )
  )
  with check (
    public.fn_is_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager')
    )
  );
