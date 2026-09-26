-- 0117_ai_provider_credentials_budgets_rls_admin
-- Bug-sweep 2026-08-12: RLS de `ai_provider_credentials` e `ai_budgets`
-- checava só pertencimento à org (fn_user_org_ids), não papel — qualquer
-- membro (viewer/agent) com sua própria sessão podia, via PostgREST direto:
--   - `ai_provider_credentials`: LER a tabela base (api_key_encrypted/iv/tag —
--     exatamente o que a view `ai_provider_credentials_safe` existe para
--     esconder de leitura não-admin) e ESCREVER/APAGAR credenciais.
--   - `ai_budgets`: reescrever `is_throttled`/`is_disabled`/`monthly_limit_cents`,
--     desativando o controle de orçamento de IA por completo sem passar pela
--     rota admin-gated (`PATCH /api/v1/ai/budget`).
-- A app já exige `requireRole("admin", ...)` nas duas rotas, mas isso só
-- protege o Route Handler — a policy é o boundary real quando o service role
-- não está em uso (PostgREST client-side com JWT do próprio usuário).
-- Mesmo padrão já usado em `api_tokens_admin_only`/`lgpd_requests_admin_*`.

alter policy "tenant_isolation_ai_provider_credentials_modify"
  on "public"."ai_provider_credentials"
  using (("public"."fn_role_at_least"("organization_id", 'admin'::"text") OR "public"."fn_is_platform_admin"()))
  with check (("public"."fn_role_at_least"("organization_id", 'admin'::"text") OR "public"."fn_is_platform_admin"()));

alter policy "tenant_isolation_ai_provider_credentials_select"
  on "public"."ai_provider_credentials"
  using (("public"."fn_role_at_least"("organization_id", 'admin'::"text") OR "public"."fn_is_platform_admin"()));

alter policy "tenant_isolation_ai_budgets_all"
  on "public"."ai_budgets"
  using (("public"."fn_role_at_least"("organization_id", 'admin'::"text") OR "public"."fn_is_platform_admin"()))
  with check (("public"."fn_role_at_least"("organization_id", 'admin'::"text") OR "public"."fn_is_platform_admin"()));
