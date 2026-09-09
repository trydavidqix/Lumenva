/**
 * Phase 7 LangGraph pilot — proposal "validate" node.
 *
 * SCOPE NOTE: see `commercial-proposal-graph.ts`'s module docblock ADDENDUM
 * for why this lives here (reusing `ProposalGraphState`) instead of at the
 * `lib/agent-engine/workflows/proposal/*` paths a stale briefing named.
 *
 * This is the `validate` step of the plan's Task 7 graph shape
 * (`load_context -> draft -> validate -> await_human_decision[interrupt] ->
 * ...`) — a DETERMINISTIC, side-effect-free gate the draft must pass before
 * a human ever sees it. Pure function of `state.draft_payload`: same draft
 * always produces the same `validation_errors`. Never calls the LLM, never
 * touches the DB, never throws for a content problem — throwing would fail
 * the whole graph run over content a human is specifically there to review;
 * this node's job is to surface findings, not to gate the graph itself.
 *
 * `error` (pipeline/node failure — "nothing was produced") and
 * `validation_errors` (content that WAS produced but failed a check) are
 * kept separate on purpose, per `ProposalGraphState`'s own field doc — this
 * node only ever writes `validation_errors`.
 *
 * Exported standalone (same convention `generateProposalNode` and
 * `loadProposalContextNode` already use) — not yet wired into
 * `commercialProposalGraph`'s compiled edges.
 */
import type { ProposalDraftPayload, ProposalGraphState } from './commercial-proposal-graph';

/** Matches the state schema's documented draft size ceiling ("~12000 chars per state schema" in this task's brief). */
export const MAX_DRAFT_CHARS = 12000;

/**
 * Forbidden internal vocabulary/secrets. Matched case-insensitively against
 * the draft's full serialized text — a leaked credential or internal
 * env-var name in a customer-facing proposal is a hard content-safety bug,
 * not a style nit (`.claude/rules/security.md` / `.claude/rules/audit-observability.md`:
 * secrets never leave the system, including into LLM-generated customer
 * content).
 */
const FORBIDDEN_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /SUPABASE_SERVICE_ROLE_KEY/i, label: 'SUPABASE_SERVICE_ROLE_KEY' },
  { pattern: /\bBearer\s+\S+/i, label: 'Bearer token' },
  { pattern: /\bsk-[A-Za-z0-9_-]{4,}/i, label: 'sk- style API key' },
  { pattern: /INTERNAL_CRON_SECRET/i, label: 'INTERNAL_CRON_SECRET' },
  { pattern: /INTERNAL_SECRET/i, label: 'INTERNAL_SECRET' },
  { pattern: /X-Api-Key\s*[:=]\s*\S+/i, label: 'X-Api-Key value' },
];

function serializeDraft(draft: ProposalDraftPayload): string {
  return [draft.proposal_title, draft.executive_summary, draft.terms, ...draft.next_steps].join('\n');
}

/**
 * Validates `state.draft_payload` deterministically:
 *  - non-empty (not whitespace-only);
 *  - <= `MAX_DRAFT_CHARS`;
 *  - no forbidden internal vocabulary/secret pattern;
 *  - does not literally contain the run's own `organization_id` (an
 *    internal identifier that has no business appearing in customer-facing
 *    text).
 *
 * Returns `{ validation_errors: [] }` when everything passes, `{
 * validation_errors: [...] }` listing every finding otherwise. Never
 * throws for a content problem — see the module docblock.
 */
export function validateProposalDraftNode(state: ProposalGraphState): Partial<ProposalGraphState> {
  if (!state.draft_payload) {
    return {
      validation_errors: [
        'draft_payload ausente — nada para validar (o nó de draft precisa rodar antes deste)',
      ],
    };
  }

  const draft = state.draft_payload;
  const serialized = serializeDraft(draft);
  const errors: string[] = [];

  if (serialized.trim().length === 0) {
    errors.push('draft vazio ou apenas espaços em branco');
  }

  if (serialized.length > MAX_DRAFT_CHARS) {
    errors.push(`draft excede o tamanho máximo permitido (${serialized.length} > ${MAX_DRAFT_CHARS} caracteres)`);
  }

  if (state.organization_id && serialized.includes(state.organization_id)) {
    errors.push('draft contém organization_id interno — identificador não deve aparecer em texto voltado ao cliente');
  }

  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(serialized)) {
      errors.push(`draft contém vocabulário/segredo proibido: ${label}`);
    }
  }

  return { validation_errors: errors };
}
