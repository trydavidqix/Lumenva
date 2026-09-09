/**
 * Phase 7 LangGraph pilot — proposal "load_context" node.
 *
 * SCOPE NOTE: see `commercial-proposal-graph.ts`'s module docblock ADDENDUM
 * for why this lives here (reusing `ProposalGraphState`) instead of at the
 * `lib/agent-engine/workflows/proposal/*` paths a stale briefing named.
 *
 * This is the `load_context` step of the plan's Task 7 graph shape
 * (`load_context -> draft -> validate -> await_human_decision[interrupt] ->
 * ...`). It resolves the OFFICIAL CRM context that `generateProposalNode`
 * treats as ground truth for pricing/contract language: contact identity
 * from `contacts`, stated needs from `crm_leads.description`/`title` (or,
 * failing that, the most recent inbound messages as a fallback signal), all
 * read directly from the canonical tenant tables. Deliberately never reads
 * Mem0/Graphiti recall-layer facts — `.claude/rules/data-modeling.md` /
 * this task's brief both forbid recall-layer output from becoming an
 * official pricing/contract authority.
 *
 * Multi-tenancy: every query filters `organization_id` explicitly — the
 * caller is expected to inject an admin (service-role) Supabase client via
 * `deps.supabase`, which bypasses RLS, so the explicit filter IS the tenant
 * boundary (`.claude/rules/multi-tenancy.md`).
 *
 * Exported standalone (same convention `generateProposalNode` already
 * uses) — not yet wired into `commercialProposalGraph`'s compiled edges.
 */
import type { createAdminClient } from '@/lib/supabase/admin';

import type { ProposalCrmContext, ProposalGraphState } from './commercial-proposal-graph';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface LoadProposalContextNodeDeps {
  /** Service-role Supabase client — see the module docblock's multi-tenancy note. */
  supabase: AdminClient;
}

/** How many most-recent inbound messages feed the `needs` fallback when no lead description/title exists. */
const NEEDS_MESSAGE_FALLBACK_LIMIT = 5;

/**
 * Honest placeholder — never invent needs/pricing/commitments not backed by
 * CRM data (same discipline `PROPOSAL_SYSTEM_PROMPT` asks of the model).
 */
const NO_NEEDS_IDENTIFIED =
  'Necessidades não identificadas na base de CRM — revisar a conversa manualmente antes de enviar a proposta.';

interface ContactRow {
  display_name: string | null;
  name: string | null;
}

interface LeadRow {
  description: string | null;
  title: string | null;
}

interface MessageRow {
  body: string | null;
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Loads `crm_context` for the proposal graph. Fails soft: returns
 * `crm_context: null` plus a `ProposalNodeError` instead of throwing, so
 * `generateProposalNode`'s existing `crm_context` guard stays the single
 * place that decides what "no context" means for the rest of the pipeline
 * (this node does not duplicate that decision).
 */
export async function loadProposalContextNode(
  state: ProposalGraphState,
  deps: LoadProposalContextNodeDeps,
): Promise<Partial<ProposalGraphState>> {
  if (!state.organization_id || !state.contact_id) {
    return {
      crm_context: null,
      error: {
        code: 'invalid_contact_data',
        message: 'organization_id/contact_id ausente no state do workflow — nó não pode carregar contexto',
      },
    };
  }

  const { data: contactData, error: contactError } = await deps.supabase
    .from('contacts')
    .select('display_name, name')
    .eq('id', state.contact_id)
    .eq('organization_id', state.organization_id) // explicit tenant filter — admin client bypasses RLS
    .maybeSingle();

  if (contactError) {
    return {
      crm_context: null,
      error: {
        code: 'crm_lookup_failed',
        message: `falha ao consultar contact ${state.contact_id}: ${contactError.message}`,
      },
    };
  }
  const contact = contactData as ContactRow | null;
  if (!contact) {
    return {
      crm_context: null,
      error: {
        code: 'invalid_contact_data',
        message: `contact ${state.contact_id} não encontrado na organização ${state.organization_id}`,
      },
    };
  }

  let lead: LeadRow | null = null;
  if (state.lead_id) {
    const { data: leadData, error: leadError } = await deps.supabase
      .from('crm_leads')
      .select('description, title')
      .eq('id', state.lead_id)
      .eq('organization_id', state.organization_id) // explicit tenant filter — admin client bypasses RLS
      .maybeSingle();
    if (leadError) {
      return {
        crm_context: null,
        error: {
          code: 'crm_lookup_failed',
          message: `falha ao consultar crm_leads ${state.lead_id}: ${leadError.message}`,
        },
      };
    }
    lead = leadData as LeadRow | null;
  }

  const needsFromLead = firstNonEmpty(lead?.description, lead?.title);

  let recentInboundBodies: string[] = [];
  if (!needsFromLead && state.conversation_id) {
    const { data: messagesData, error: messagesError } = await deps.supabase
      .from('messages')
      .select('body')
      .eq('conversation_id', state.conversation_id)
      .eq('organization_id', state.organization_id) // explicit tenant filter — admin client bypasses RLS
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false })
      .limit(NEEDS_MESSAGE_FALLBACK_LIMIT);
    if (messagesError) {
      return {
        crm_context: null,
        error: {
          code: 'crm_lookup_failed',
          message: `falha ao consultar messages da conversa ${state.conversation_id}: ${messagesError.message}`,
        },
      };
    }
    const messages = (messagesData ?? []) as MessageRow[];
    recentInboundBodies = messages.map((m) => m.body?.trim()).filter((body): body is string => Boolean(body));
  }

  const needs =
    needsFromLead ?? (recentInboundBodies.length > 0 ? recentInboundBodies.reverse().join(' | ') : NO_NEEDS_IDENTIFIED);

  const crmContext: ProposalCrmContext = {
    contact_name: firstNonEmpty(contact.display_name, contact.name) ?? 'Cliente',
    // DIRC (`.claude/rules/data-modeling.md`): no canonical `company` column
    // exists on `contacts`/`crm_leads` today. Reading an undeclared
    // `custom_fields` path without a central schema would be exactly the
    // "jsonb lock-in com UI lendo path sem schema central" anti-pattern —
    // `null` is the honest value until a declared field/schema exists.
    company: null,
    needs,
  };

  return { crm_context: crmContext, error: null };
}
