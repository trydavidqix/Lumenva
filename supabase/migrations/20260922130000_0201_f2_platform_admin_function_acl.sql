-- F2 hardening: the SECURITY DEFINER audit function is callable only through
-- the explicit, audited platform_admin_runtime path.
revoke execute on function public.record_platform_admin_tenant_access(uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_platform_admin_tenant_access(uuid, text)
  to platform_admin_runtime;
