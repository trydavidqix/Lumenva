-- 0119_ai_workflow_runs
-- Fase 7 (LangGraph), Task 2 — registro oficial de execuções de workflow.
--
-- NNNN=0119, não 0117 como o plano original previa
-- (docs/superpowers/plans/2026-08-10-ai-platform-phase-7-langgraph.md): 0117 já
-- foi tomado por `20260812203804_0117_ai_provider_credentials_budgets_rls_admin`
-- (bug-sweep mergeado na main antes desta task rodar) e 0118 está reservado pelo
-- mesmo plano para a Task 3 (`langgraph_checkpoint_schema`) — verificado contra
-- todas as branches/worktrees locais nesta árvore.
--
-- Esta tabela é o registro por-tenant de UMA execução de workflow LangGraph
-- (piloto: 'commercial_proposal' — proposta → aprovação do manager → envio →
-- follow-up). `thread_id` é gerado pelo SERVIDOR e amarrado a esta linha; nunca
-- é aceito como autoridade vinda de usuário/modelo (doutrina da Fase 7).
--
-- Este estado de workflow é SEPARADO do estado de lead/contact/conversation do
-- CRM — não substitui `crm_leads`/`crm_lead_activities`, apenas referencia-os.
-- A feature nasce OFF/SHADOW (ai_platform_feature_flags.feature =
-- 'langgraph_proposal_workflow', migration 0116): esta migration só cria o
-- schema, sem side effect real de envio/aprovação.
--
-- Doutrina explícita (CLAUDE.md invariante 4 + esta task): NUNCA persistir
-- chave de provedor de IA nem blob de checkpoint bruto do LangGraph nesta
-- tabela — checkpoint é responsabilidade de schema próprio (Task 3).

create table if not exists public.ai_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Vocabulário fechado de propósito: tabela nova, sem dado legado a proteger,
  -- e a Fase 7 pilota exatamente UM workflow. Ampliar é forward-fix quando o
  -- segundo workflow nascer, não flexibilidade antecipada.
  workflow_type text not null check (workflow_type in ('commercial_proposal')),

  -- Gerado pelo servidor no momento da criação da linha; nunca aceito do body
  -- do request (thread_id não é autoridade de cliente).
  thread_id uuid not null,

  contact_id uuid not null references public.contacts(id) on delete restrict,
  conversation_id uuid references public.conversations(id) on delete set null,
  lead_id uuid references public.crm_leads(id) on delete set null,

  status text not null default 'shadow' check (status in (
    'shadow', 'drafting', 'awaiting_approval', 'approved', 'rejected',
    'sending', 'completed', 'failed', 'cancelled'
  )),

  draft_payload jsonb not null default '{}'::jsonb,
  decision_payload jsonb,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,

  -- Chave de idempotência do side effect real (envio da proposta). Única por
  -- org: mesmo padrão de `(organization_id, external_id)` do inbound WAHA —
  -- reexecução do worker não duplica o envio.
  side_effect_key text not null,

  sent_message_id uuid references public.messages(id) on delete set null,
  -- followup_enrollments.id é uuid (supabase/baseline.sql) — mesmo tipo aqui.
  followup_id uuid references public.followup_enrollments(id) on delete set null,
  last_error_code text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_workflow_runs_thread_unique unique (organization_id, thread_id),
  constraint ai_workflow_runs_side_effect_unique unique (organization_id, side_effect_key),

  -- Decisão e decisor andam juntos (mesmo padrão de
  -- crm_lead_reactivations_decisao_datada): um só dos dois setado é registro
  -- que não sabe dizer quem/quando decidiu.
  constraint ai_workflow_runs_decision_coherence check (
    (decided_by is null and decided_at is null)
    or (decided_by is not null and decided_at is not null)
  )
);

comment on table public.ai_workflow_runs is
  'Fase 7 (LangGraph) — registro por-tenant de execuções de workflow (piloto: commercial_proposal). Estado de workflow separado do estado de lead/contact/conversation do CRM. Nunca guarda chave de provedor nem checkpoint bruto do LangGraph.';

create index if not exists idx_ai_workflow_runs_org_status
  on public.ai_workflow_runs (organization_id, status);

create index if not exists idx_ai_workflow_runs_contact
  on public.ai_workflow_runs (organization_id, contact_id);

drop trigger if exists trg_ai_workflow_runs_updated_at on public.ai_workflow_runs;
create trigger trg_ai_workflow_runs_updated_at
  before update on public.ai_workflow_runs
  for each row execute function public.fn_set_updated_at();

alter table public.ai_workflow_runs enable row level security;

-- Isolamento de tenant + papel: leitura E escrita exigem manager+ (viewer/agent
-- não enxergam nem escrevem). `decided_by` (aprovação/rejeição) fica coberto
-- pela MESMA policy — não há caminho de escrita nesta tabela abaixo de
-- manager, então não há necessidade de uma policy de coluna separada só para
-- `decided_by`. Platform admin atravessa via fn_is_platform_admin(), mesmo
-- padrão de api_tokens_admin_only/ai_budgets. Sem policy para `anon` —
-- RLS ligada e ausência de policy é deny-by-default.
drop policy if exists tenant_isolation_ai_workflow_runs_all on public.ai_workflow_runs;
create policy tenant_isolation_ai_workflow_runs_all on public.ai_workflow_runs
  for all
  to authenticated
  using (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager'))
    or public.fn_is_platform_admin()
  )
  with check (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager'))
    or public.fn_is_platform_admin()
  );

grant select, insert, update, delete on public.ai_workflow_runs to authenticated;
grant all on public.ai_workflow_runs to service_role;

notify pgrst, 'reload schema';
