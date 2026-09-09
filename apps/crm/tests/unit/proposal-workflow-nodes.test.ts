import { describe, expect, it } from "vitest";

/**
 * Phase 7 LangGraph pilot — `loadProposalContextNode` + `validateProposalDraftNode`.
 *
 * See `lib/workflows/commercial-proposal-graph.ts`'s module docblock
 * ADDENDUM for why these two nodes live under `lib/workflows/` against the
 * existing `ProposalGraphState`, instead of at the
 * `lib/agent-engine/workflows/proposal/*` paths this task's original
 * briefing named (that path/state shape does not exist in this tree).
 *
 * The fake Supabase client applies REAL `.eq()` filters against seeded
 * per-org row lists (same "progressive candidate narrowing" technique as
 * `lib/agent-engine/workflows/repository.test.ts`), so a dropped
 * `organization_id` filter in the module under test would WIDEN the match
 * set instead of silently narrowing to zero.
 */
import {
  loadProposalContextNode,
  type LoadProposalContextNodeDeps,
} from "@/lib/workflows/load-proposal-context-node";
import {
  MAX_DRAFT_CHARS,
  validateProposalDraftNode,
} from "@/lib/workflows/validate-proposal-draft-node";
import type { ProposalDraftPayload, ProposalGraphState } from "@/lib/workflows/commercial-proposal-graph";

const ORG_A = "org-a";
const ORG_B = "org-b";
const CONTACT_A = "contact-a";
const LEAD_A = "lead-a";
const CONVERSATION_A = "conv-a";

type Row = Record<string, unknown>;

/** Builder that supports `.eq()` chaining + terminal `.maybeSingle()` (single-row tables). */
function eqFilterableSingle(rows: Row[]) {
  return {
    select: () => {
      let candidates = rows;
      const builder = {
        eq: (col: string, val: unknown) => {
          candidates = candidates.filter((row) => row[col] === val);
          return builder;
        },
        maybeSingle: async () => ({ data: candidates[0] ?? null, error: null }),
      };
      return builder;
    },
  };
}

/** Builder that supports `.eq()` chaining + `.order()` + `.limit()` (multi-row, thenable — like the real query builder). */
function eqFilterableList(rows: Row[]) {
  return {
    select: () => {
      let candidates = rows;
      let sortCol: string | null = null;
      let sortAsc = true;
      let limitN = Infinity;
      const builder = {
        eq: (col: string, val: unknown) => {
          candidates = candidates.filter((row) => row[col] === val);
          return builder;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          sortCol = col;
          sortAsc = opts?.ascending ?? true;
          return builder;
        },
        limit: (n: number) => {
          limitN = n;
          return builder;
        },
        then: (resolve: (v: { data: Row[]; error: null }) => void) => {
          let result = [...candidates];
          if (sortCol) {
            const col = sortCol;
            result = result.sort((a, b) => {
              const av = String(a[col]);
              const bv = String(b[col]);
              return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
            });
          }
          resolve({ data: result.slice(0, limitN), error: null });
        },
      };
      return builder;
    },
  };
}

function buildFakeSupabase(tables: {
  contacts?: Row[];
  crm_leads?: Row[];
  messages?: Row[];
  errorOnTable?: string;
}): LoadProposalContextNodeDeps["supabase"] {
  return {
    from: (table: string) => {
      if (tables.errorOnTable === table) {
        return {
          select: () => {
            const builder = {
              eq: () => builder,
              order: () => builder,
              limit: () => builder,
              maybeSingle: async () => ({ data: null, error: { message: `boom on ${table}` } }),
              then: (resolve: (v: { data: null; error: { message: string } }) => void) =>
                resolve({ data: null, error: { message: `boom on ${table}` } }),
            };
            return builder;
          },
        };
      }
      if (table === "contacts") return eqFilterableSingle(tables.contacts ?? []);
      if (table === "crm_leads") return eqFilterableSingle(tables.crm_leads ?? []);
      if (table === "messages") return eqFilterableList(tables.messages ?? []);
      throw new Error(`unexpected table ${table}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const BASE_STATE: ProposalGraphState = {
  organization_id: ORG_A,
  contact_id: CONTACT_A,
  lead_id: LEAD_A,
  conversation_id: CONVERSATION_A,
  crm_context: null,
  draft_payload: null,
  validation_errors: null,
  error: null,
};

describe("loadProposalContextNode", () => {
  it("happy path: contact + lead description resolve into crm_context, tenant-filtered", async () => {
    const supabase = buildFakeSupabase({
      contacts: [
        { id: CONTACT_A, organization_id: ORG_A, display_name: "Rafael Souza", name: "Rafael" },
        { id: "contact-other-org", organization_id: ORG_B, display_name: "Should Not Leak", name: null },
      ],
      crm_leads: [
        {
          id: LEAD_A,
          organization_id: ORG_A,
          description: "Precisa de CRM com WhatsApp nativo para 5 vendedores.",
          title: "Oportunidade Acme",
        },
      ],
    });

    const out = await loadProposalContextNode(BASE_STATE, { supabase });

    expect(out.error).toBeNull();
    expect(out.crm_context).toEqual({
      contact_name: "Rafael Souza",
      company: null,
      needs: "Precisa de CRM com WhatsApp nativo para 5 vendedores.",
    });
  });

  it("falls back to lead title when description is empty, then to recent inbound messages when there is no lead", async () => {
    const supabase = buildFakeSupabase({
      contacts: [{ id: CONTACT_A, organization_id: ORG_A, display_name: null, name: "Rafael" }],
      messages: [
        { conversation_id: CONVERSATION_A, organization_id: ORG_A, direction: "inbound", body: "Preciso de um CRM", sent_at: "2026-01-01" },
        { conversation_id: CONVERSATION_A, organization_id: ORG_A, direction: "outbound", body: "Claro, me conta mais", sent_at: "2026-01-02" },
        { conversation_id: CONVERSATION_A, organization_id: ORG_A, direction: "inbound", body: "Para 5 vendedores", sent_at: "2026-01-03" },
      ],
    });

    const state: ProposalGraphState = { ...BASE_STATE, lead_id: null };
    const out = await loadProposalContextNode(state, { supabase });

    expect(out.error).toBeNull();
    expect(out.crm_context?.needs).toBe("Preciso de um CRM | Para 5 vendedores");
  });

  it("uses the honest placeholder when no lead and no inbound messages exist", async () => {
    const supabase = buildFakeSupabase({
      contacts: [{ id: CONTACT_A, organization_id: ORG_A, display_name: "Rafael", name: null }],
      messages: [],
    });

    const state: ProposalGraphState = { ...BASE_STATE, lead_id: null, conversation_id: null };
    const out = await loadProposalContextNode(state, { supabase });

    expect(out.error).toBeNull();
    expect(out.crm_context?.needs).toMatch(/Necessidades não identificadas/);
  });

  it("contact not found in organization: returns null context + invalid_contact_data error, does not throw", async () => {
    const supabase = buildFakeSupabase({
      contacts: [{ id: CONTACT_A, organization_id: ORG_B, display_name: "Wrong Org", name: null }],
    });

    const out = await loadProposalContextNode(BASE_STATE, { supabase });

    expect(out.crm_context).toBeNull();
    expect(out.error?.code).toBe("invalid_contact_data");
  });

  it("cross-tenant: a contact that exists only in another org is treated as not found for this org", async () => {
    const supabase = buildFakeSupabase({
      contacts: [{ id: CONTACT_A, organization_id: ORG_B, display_name: "Belongs to org B", name: null }],
      crm_leads: [{ id: LEAD_A, organization_id: ORG_A, description: "leaked?", title: null }],
    });

    const out = await loadProposalContextNode(BASE_STATE, { supabase });

    expect(out.crm_context).toBeNull();
    expect(out.error?.code).toBe("invalid_contact_data");
  });

  it("missing organization_id/contact_id: returns error without querying", async () => {
    const supabase = buildFakeSupabase({});
    const state: ProposalGraphState = { ...BASE_STATE, contact_id: "" };

    const out = await loadProposalContextNode(state, { supabase });

    expect(out.error?.code).toBe("invalid_contact_data");
    expect(out.crm_context).toBeNull();
  });

  it("DB error on contact lookup: surfaces crm_lookup_failed, does not throw", async () => {
    const supabase = buildFakeSupabase({ errorOnTable: "contacts" });

    const out = await loadProposalContextNode(BASE_STATE, { supabase });

    expect(out.error?.code).toBe("crm_lookup_failed");
    expect(out.crm_context).toBeNull();
  });

  it("DB error on lead lookup: surfaces crm_lookup_failed", async () => {
    const supabase = buildFakeSupabase({
      contacts: [{ id: CONTACT_A, organization_id: ORG_A, display_name: "Rafael", name: null }],
      errorOnTable: "crm_leads",
    });

    const out = await loadProposalContextNode(BASE_STATE, { supabase });

    expect(out.error?.code).toBe("crm_lookup_failed");
  });
});

const VALID_DRAFT: ProposalDraftPayload = {
  proposal_title: "Proposta DeskcommCRM — Acme Ltda",
  executive_summary: "Resumo executivo da proposta para a Acme Ltda.",
  terms: "Plano mensal, sem fidelidade, suporte incluso.",
  next_steps: ["Agendar demo", "Confirmar número de assentos"],
};

describe("validateProposalDraftNode", () => {
  it("happy path: valid draft produces an empty validation_errors array", () => {
    const state: ProposalGraphState = { ...BASE_STATE, draft_payload: VALID_DRAFT };

    const out = validateProposalDraftNode(state);

    expect(out.validation_errors).toEqual([]);
  });

  it("missing draft_payload: reports a finding instead of throwing", () => {
    const state: ProposalGraphState = { ...BASE_STATE, draft_payload: null };

    const out = validateProposalDraftNode(state);

    expect(out.validation_errors).toHaveLength(1);
    expect(out.validation_errors![0]).toMatch(/draft_payload ausente/);
  });

  it("whitespace-only draft is rejected as empty", () => {
    const draft: ProposalDraftPayload = {
      proposal_title: "   ",
      executive_summary: "   ",
      terms: "   ",
      next_steps: ["   "],
    };
    const state: ProposalGraphState = { ...BASE_STATE, draft_payload: draft };

    const out = validateProposalDraftNode(state);

    expect(out.validation_errors).toContain("draft vazio ou apenas espaços em branco");
  });

  it("draft exceeding MAX_DRAFT_CHARS is rejected", () => {
    const draft: ProposalDraftPayload = {
      ...VALID_DRAFT,
      executive_summary: "x".repeat(MAX_DRAFT_CHARS + 1),
    };
    const state: ProposalGraphState = { ...BASE_STATE, draft_payload: draft };

    const out = validateProposalDraftNode(state);

    expect(out.validation_errors!.some((e) => e.includes("excede o tamanho máximo"))).toBe(true);
  });

  it("draft within MAX_DRAFT_CHARS at the exact boundary passes the size check", () => {
    const padding = "x".repeat(
      MAX_DRAFT_CHARS -
        (VALID_DRAFT.proposal_title.length +
          1 +
          VALID_DRAFT.terms.length +
          1 +
          VALID_DRAFT.next_steps.join("\n").length +
          1),
    );
    const draft: ProposalDraftPayload = { ...VALID_DRAFT, executive_summary: padding };
    const state: ProposalGraphState = { ...BASE_STATE, draft_payload: draft };

    const out = validateProposalDraftNode(state);

    expect(out.validation_errors!.some((e) => e.includes("excede o tamanho máximo"))).toBe(false);
  });

  it.each([
    ["SUPABASE_SERVICE_ROLE_KEY", "eyJ...leaked SUPABASE_SERVICE_ROLE_KEY value..."],
    ["Bearer token", "Authorization: Bearer abc123def456"],
    ["sk- style API key", "our key is sk-ABC123DEF456"],
    ["INTERNAL_CRON_SECRET", "leaked INTERNAL_CRON_SECRET=xyz"],
    ["X-Api-Key value", "X-Api-Key: super-secret-value"],
  ])("rejects a draft containing forbidden pattern: %s", (label, poison) => {
    const draft: ProposalDraftPayload = { ...VALID_DRAFT, terms: poison };
    const state: ProposalGraphState = { ...BASE_STATE, draft_payload: draft };

    const out = validateProposalDraftNode(state);

    expect(out.validation_errors!.some((e) => e.includes(label))).toBe(true);
  });

  it("rejects a draft that leaks the run's own organization_id", () => {
    const draft: ProposalDraftPayload = {
      ...VALID_DRAFT,
      terms: `Ref interno: ${ORG_A}`,
    };
    const state: ProposalGraphState = { ...BASE_STATE, organization_id: ORG_A, draft_payload: draft };

    const out = validateProposalDraftNode(state);

    expect(out.validation_errors!.some((e) => e.includes("organization_id interno"))).toBe(true);
  });

  it("is deterministic: same draft always produces the same validation result", () => {
    const state: ProposalGraphState = { ...BASE_STATE, draft_payload: VALID_DRAFT };

    const first = validateProposalDraftNode(state);
    const second = validateProposalDraftNode(state);

    expect(first).toEqual(second);
  });
});

describe("state threading: load_context -> draft -> validate", () => {
  it("feeds loadProposalContextNode's output into a draft, then into validateProposalDraftNode, end to end", async () => {
    const supabase = buildFakeSupabase({
      contacts: [{ id: CONTACT_A, organization_id: ORG_A, display_name: "Rafael Souza", name: null }],
      crm_leads: [{ id: LEAD_A, organization_id: ORG_A, description: "Precisa de CRM com WhatsApp nativo.", title: null }],
    });

    let state: ProposalGraphState = { ...BASE_STATE };

    const afterContext = await loadProposalContextNode(state, { supabase });
    state = { ...state, ...afterContext };
    expect(state.crm_context).not.toBeNull();
    expect(state.error).toBeNull();

    // Simulates generateProposalNode's output (already covered by
    // commercial-proposal-graph.test.ts) — this suite only proves the state
    // threads correctly into the next node, not the LLM call itself.
    state = { ...state, draft_payload: VALID_DRAFT, error: null };

    const afterValidate = validateProposalDraftNode(state);
    state = { ...state, ...afterValidate };

    expect(state.validation_errors).toEqual([]);
  });

  it("threads a load_context failure through to validate without crashing (validate reports the missing draft)", async () => {
    const supabase = buildFakeSupabase({ contacts: [] });

    let state: ProposalGraphState = { ...BASE_STATE };
    const afterContext = await loadProposalContextNode(state, { supabase });
    state = { ...state, ...afterContext };
    expect(state.error?.code).toBe("invalid_contact_data");
    expect(state.draft_payload).toBeNull();

    const afterValidate = validateProposalDraftNode(state);
    state = { ...state, ...afterValidate };

    expect(state.validation_errors).toHaveLength(1);
    expect(state.validation_errors![0]).toMatch(/draft_payload ausente/);
  });
});
