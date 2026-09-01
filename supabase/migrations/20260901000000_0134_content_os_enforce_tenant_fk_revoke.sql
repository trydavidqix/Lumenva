-- Content OS security forward-fix.
-- This function is invoked only by internal table triggers. It must not be
-- callable as an RPC by browser roles: SECURITY DEFINER can write across RLS.

revoke execute on function public.content_os_enforce_tenant_fk() from public;
revoke execute on function public.content_os_enforce_tenant_fk() from anon;
revoke execute on function public.content_os_enforce_tenant_fk() from authenticated;
grant execute on function public.content_os_enforce_tenant_fk() to service_role;
