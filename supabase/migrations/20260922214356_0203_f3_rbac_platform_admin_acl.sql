-- REVOKE excessive platform_admins privileges per F3 RBAC audit.
-- platform_admins should only be mutated by postgres (DBA).
-- Also preserve RLS helper privileges on SELECT.

REVOKE ALL ON TABLE public.platform_admins FROM anon, authenticated, service_role, public;
GRANT SELECT ON TABLE public.platform_admins TO authenticated;
GRANT SELECT ON TABLE public.platform_admins TO service_role;
