-- 0123: índice em organization_id nas tabelas que ainda não tinham.
--
-- Achado numa auditoria de performance (2026-08-21) cruzando a doutrina oficial
-- da Supabase ("toda condição de filtro numa política de RLS precisa usar
-- índice, senão toda tabela fica lenta") contra o schema real de produção:
-- 18 de 94 tabelas com organization_id não tinham nenhum índice tocando essa
-- coluna, obrigando a política de RLS (`organization_id in (select
-- fn_user_org_ids())`, presente em todas via `.claude/rules/multi-tenancy.md`)
-- a fazer sequential scan em vez de busca indexada nessas tabelas. Não
-- afetava nada hoje (tabelas ainda pequenas), mas seria o primeiro gargalo
-- perceptível conforme o volume crescer.
--
-- `ai_provider_credentials_safe` foi excluída da lista: é uma VIEW (não pode
-- ter índice próprio) sobre `ai_provider_credentials`, que já tem índice
-- composto cobrindo organization_id (`ai_provider_credentials_org_provider_idx`).
--
-- Índice simples (não composto) — cobre o filtro de RLS por organização, que é
-- o padrão comum a todas; não há query hot-path documentada exigindo coluna
-- adicional. Puramente aditivo: sem backfill, sem validação de constraint,
-- sem risco de bloquear escrita (CREATE INDEX comum aqui é aceitável — nenhuma
-- destas tabelas tem volume que justifique CONCURRENTLY dentro de uma
-- transação de migration).
create index if not exists agent_case_events_organization_id_idx on public.agent_case_events (organization_id);
create index if not exists ai_agent_versions_organization_id_idx on public.ai_agent_versions (organization_id);
create index if not exists ai_knowledge_sources_organization_id_idx on public.ai_knowledge_sources (organization_id);
create index if not exists ai_knowledge_versions_organization_id_idx on public.ai_knowledge_versions (organization_id);
create index if not exists ai_router_members_organization_id_idx on public.ai_router_members (organization_id);
create index if not exists ai_routers_organization_id_idx on public.ai_routers (organization_id);
create index if not exists conversation_assignment_events_organization_id_idx on public.conversation_assignment_events (organization_id);
create index if not exists conversation_notes_organization_id_idx on public.conversation_notes (organization_id);
create index if not exists crm_stages_organization_id_idx on public.crm_stages (organization_id);
create index if not exists disclosure_template_versions_organization_id_idx on public.disclosure_template_versions (organization_id);
create index if not exists followup_enrollment_events_organization_id_idx on public.followup_enrollment_events (organization_id);
create index if not exists followup_flow_versions_organization_id_idx on public.followup_flow_versions (organization_id);
create index if not exists playbook_versions_organization_id_idx on public.playbook_versions (organization_id);
create index if not exists promise_table_versions_organization_id_idx on public.promise_table_versions (organization_id);
create index if not exists reentry_knob_versions_organization_id_idx on public.reentry_knob_versions (organization_id);
create index if not exists reentry_template_versions_organization_id_idx on public.reentry_template_versions (organization_id);
create index if not exists skill_versions_organization_id_idx on public.skill_versions (organization_id);
create index if not exists webhook_sources_organization_id_idx on public.webhook_sources (organization_id);
