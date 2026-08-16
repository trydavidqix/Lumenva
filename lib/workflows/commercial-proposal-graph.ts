/**
 * Phase 7 LangGraph pilot — proposal generation node.
 *
 * SCOPE NOTE (documented per `.claude/rules/git-workflow.md` "disciplina de
 * escopo"): the SDD ledger for this initiative
 * (`.superpowers/sdd/2026-08-10-ai-platform-phase-7-langgraph/progress.md`)
 * numbers this "Task 3: LangGraph node (proposal generation)" — a
 * deliberately collapsed/simplified slice of what
 * `docs/superpowers/plans/2026-08-10-ai-platform-phase-7-langgraph.md`
 * spreads across Tasks 4 (state schema), 6 (drafting node) and part of 7
 * (graph wiring). This file does NOT implement the checkpointer, the
 * human-approval interrupt, exactly-once send, or follow-up scheduling —
 * those remain the ledger's Tasks 4-7 (this session's numbering), matching
 * the plan's Tasks 4/7/8/9. No database writes happen here; the caller is
 * responsible for persisting `draft_payload` into `ai_workflow_runs`.
 *
 * LLM seam: this node calls `runModelCall` — the harness's SINGLE seam for
 * model calls (see `lib/agent-engine/edge/llm/run-model-call.ts` docblock).
 * No new LLM/provider instance is created here.
 *
 * Multi-tenancy: `organization_id` is a REQUIRED state field even though the
 * brief's minimal state shape only lists
 * `{ contact_id, lead_id, conversation_id, draft_payload }`. `runModelCall`
 * requires a tenant id for budget enforcement, credential resolution and
 * `llm_calls` attribution, and `.claude/rules/multi-tenancy.md` forbids any
 * tenant-aware operation without an explicit, trusted tenant id threaded
 * through. Omitting it here would mean the workflow row's real
 * `organization_id` (Task 2 schema) has no path into the LLM call at all.
 * The caller must populate `organization_id` from the trusted
 * `ai_workflow_runs` row — never from request body/model output.
 *
 * ADDENDUM (proposal drafting nodes follow-up): the briefing that produced
 * this addendum asked for a from-scratch `ProposalWorkflowState` at
 * `lib/agent-engine/workflows/proposal/state.ts` — that path does NOT exist
 * in this tree (confirmed via grep; only referenced in the plan doc, same
 * gap `progress.md`'s "Numbering note" already recorded for the plan's own
 * Task 4). Building a second, parallel state shape for the same graph would
 * be the `.claude/rules/data-modeling.md` "duplicação sem source of
 * verdade" anti-pattern, so the two still-missing nodes from that briefing
 * (`load_context`, `validate`) were implemented against THIS file's existing
 * `ProposalGraphState` instead: `load-proposal-context-node.ts`
 * (`loadProposalContextNode`) and `validate-proposal-draft-node.ts`
 * (`validateProposalDraftNode`). The briefing's third node (`draftProposal`)
 * is `generateProposalNode` below, unchanged — it already satisfies that
 * brief's contract (runModelCall, purpose `proposal_workflow_draft`, catches
 * LLM errors) and rewriting it under a new name would just be a duplicate.
 * Neither new node is wired into `commercialProposalGraph`'s compiled edges
 * yet — graph assembly (plus the human-approval interrupt) stays a separate,
 * later task, same "exported standalone, not yet wired" convention this
 * file's own docblock already used for `generateProposalNode`.
 */
import {
  Annotation,
  END,
  START,
  StateGraph,
  type BaseCheckpointSaver,
  type LangGraphRunnableConfig,
} from '@langchain/langgraph';
import type pg from 'pg';
import { z } from 'zod';

import { runModelCall, type LlmEdgeConfig } from '../agent-engine/edge/llm/run-model-call';
import type { Logger } from '../agent-engine/obs/logger';

/**
 * CRM context assumed already resolved into the graph state by the upstream
 * setup step — `loadProposalContextNode` in `load-proposal-context-node.ts`
 * populates this from canonical CRM tables (contacts/crm_leads/messages)
 * only, never Mem0/Graphiti recall facts; this node only consumes it. Never
 * fetched by `generateProposalNode` itself.
 */
export const proposalCrmContextSchema = z.object({
  contact_name: z.string().min(1),
  company: z.string().min(1).nullable(),
  needs: z.string().min(1),
});
export type ProposalCrmContext = z.infer<typeof proposalCrmContextSchema>;

/** Structured proposal draft — the exact shape stored into `ai_workflow_runs.draft_payload`. */
export const proposalDraftPayloadSchema = z.object({
  proposal_title: z.string().min(1).max(200),
  executive_summary: z.string().min(1).max(4000),
  terms: z.string().min(1).max(4000),
  next_steps: z.array(z.string().min(1).max(500)).min(1).max(10),
});
export type ProposalDraftPayload = z.infer<typeof proposalDraftPayloadSchema>;

export interface ProposalNodeError {
  code: 'invalid_contact_data' | 'crm_lookup_failed' | 'llm_call_failed' | 'invalid_llm_output';
  message: string;
}

export const ProposalGraphStateAnnotation = Annotation.Root({
  organization_id: Annotation<string>(),
  contact_id: Annotation<string>(),
  lead_id: Annotation<string | null>(),
  conversation_id: Annotation<string | null>(),
  crm_context: Annotation<ProposalCrmContext | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  draft_payload: Annotation<ProposalDraftPayload | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  /**
   * Deterministic output of the "validate" step (plan's Task 7 graph shape:
   * `load_context -> draft -> validate -> await_human_decision[interrupt] -> ...`,
   * see `validate-proposal-draft-node.ts`). `null` means "not yet validated",
   * `[]` means "validated, no findings", non-empty means the draft must not
   * reach a human/send step unreviewed. Separate from `error` on purpose —
   * `error` is a pipeline/node failure (nothing to show), `validation_errors`
   * is content that DID get produced but failed a deterministic content check.
   */
  validation_errors: Annotation<string[] | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  error: Annotation<ProposalNodeError | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type ProposalGraphState = typeof ProposalGraphStateAnnotation.State;

/** Fixed instruction — a stable marker so tests/prompt review can pin the contract. */
export const PROPOSAL_SYSTEM_PROMPT =
  'Você é um assistente de vendas B2B gerando um RASCUNHO de proposta comercial para revisão ' +
  'humana antes de qualquer envio ao cliente. Responda SOMENTE com um objeto JSON válido, sem ' +
  'markdown, sem texto fora do JSON, exatamente neste formato: ' +
  '{"proposal_title": string, "executive_summary": string, "terms": string, "next_steps": string[]}. ' +
  'Não invente preço, prazo legal ou compromisso que não esteja no contexto fornecido — se um campo ' +
  'não tiver base no contexto, escreva um placeholder explícito como "[a confirmar]" em vez de inventar.';

function buildProposalUserPrompt(context: ProposalCrmContext): string {
  return [
    '## Contexto do cliente (CRM oficial)',
    `Nome do contato: ${context.contact_name}`,
    `Empresa: ${context.company ?? 'não informado'}`,
    `Necessidades identificadas: ${context.needs}`,
    '',
    'Gere o rascunho da proposta comercial no formato JSON especificado.',
  ].join('\n');
}

/** Tolerates an accidental ```json fence around the model's JSON output before parsing. */
function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function parseProposalDraft(text: string): ProposalDraftPayload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(stripCodeFence(text));
  } catch {
    return null;
  }
  const parsed = proposalDraftPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export interface GenerateProposalNodeDeps {
  db: pg.Pool;
  llmCfg: LlmEdgeConfig;
  log?: Logger;
  /** Model override — subject to the org's `enabled_models`, resolved by the caller. Never hardcoded here. */
  model?: string;
}

/**
 * The ReAct-style generation step: takes contact/lead context already
 * resolved into `state.crm_context`, calls the model once via the harness
 * seam, and returns a Zod-validated structured draft. Pure with respect to
 * persistence — no DB write, no side effect beyond the `runModelCall` audit
 * trail (`llm_calls`) that the seam itself owns.
 *
 * Exported standalone (not only reachable through the compiled graph) so it
 * is directly unit-testable with fake `db`/`llmCfg` deps, per the task's
 * "isolate the node function" requirement.
 */
export async function generateProposalNode(
  state: ProposalGraphState,
  deps: GenerateProposalNodeDeps,
): Promise<Partial<ProposalGraphState>> {
  if (!state.organization_id || !state.contact_id) {
    return {
      error: {
        code: 'invalid_contact_data',
        message: 'organization_id/contact_id ausente no state do workflow — nó não pode prosseguir',
      },
    };
  }

  const contextResult = proposalCrmContextSchema.safeParse(state.crm_context);
  if (!contextResult.success) {
    return {
      error: {
        code: 'invalid_contact_data',
        message: 'crm_context ausente ou incompleto (esperado contact_name/company/needs) — nó não pode gerar a proposta',
      },
    };
  }
  const context = contextResult.data;

  let callResult;
  try {
    callResult = await runModelCall(
      deps.db,
      deps.llmCfg,
      {
        tenantId: state.organization_id,
        leadId: state.lead_id ?? undefined,
        purpose: 'proposal_workflow_draft',
        system: PROPOSAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildProposalUserPrompt(context) }],
        ...(deps.model !== undefined ? { model: deps.model } : {}),
        // Sem tools/maxSteps: o SDK para no 1º step (default stepCountIs(1)) —
        // saída de texto único, sem risco do modelo tentar chamar tool alguma.
      },
      { log: deps.log },
    );
  } catch (error) {
    return {
      error: {
        code: 'llm_call_failed',
        message: error instanceof Error ? error.message : 'falha desconhecida na chamada ao modelo',
      },
    };
  }

  const draft = parseProposalDraft(callResult.result.text ?? '');
  if (draft === null) {
    return {
      error: {
        code: 'invalid_llm_output',
        message: 'saída do modelo não corresponde ao schema esperado de proposta (proposal_title/executive_summary/terms/next_steps)',
      },
    };
  }

  return { draft_payload: draft, error: null };
}

interface ProposalGraphConfigurable {
  db: pg.Pool;
  llmCfg: LlmEdgeConfig;
  log?: Logger;
  model?: string;
}

/**
 * Dependencies (`db`/`llmCfg`) are injected via `config.configurable` rather
 * than graph state — LangGraph's standard seam for non-serializable
 * infrastructure (a `pg.Pool` has no business living in checkpointed state).
 * Fails closed with a clear error instead of silently calling with undefined
 * deps if the caller forgets to pass them.
 */
function extractDeps(config: LangGraphRunnableConfig | undefined): GenerateProposalNodeDeps {
  const configurable = config?.configurable as Partial<ProposalGraphConfigurable> | undefined;
  if (configurable?.db === undefined || configurable?.llmCfg === undefined) {
    throw new Error(
      'commercialProposalGraph: config.configurable.db/llmCfg ausentes — invoque com ' +
        '{ configurable: { db, llmCfg } }',
    );
  }
  return {
    db: configurable.db,
    llmCfg: configurable.llmCfg,
    ...(configurable.log !== undefined ? { log: configurable.log } : {}),
    ...(configurable.model !== undefined ? { model: configurable.model } : {}),
  };
}

const graphBuilder = new StateGraph(ProposalGraphStateAnnotation)
  .addNode('node_generate_proposal', (state, config) => generateProposalNode(state, extractDeps(config)))
  .addEdge(START, 'node_generate_proposal')
  .addEdge('node_generate_proposal', END);

/**
 * Compiled entry point: `START -> node_generate_proposal -> END`. Invoke
 * with `commercialProposalGraph.invoke(state, { configurable: { db, llmCfg } })`.
 * No checkpointer is attached here — this graph never interrupts, so there
 * is nothing to resume yet (see the module docblock scope note), and
 * existing call sites (including this file's own test suite) invoke it
 * without a `thread_id`. Once a `BaseCheckpointSaver` is attached to a
 * compiled graph, LangGraph requires `configurable.thread_id` on every
 * invoke — so this uncheckpointed export stays as-is, and
 * `compileCommercialProposalGraphWithCheckpointer` below is the separate,
 * additive entry point for callers that need persistence/resume (Task 4 —
 * see `checkpointer-config.ts`'s scope note).
 */
export const commercialProposalGraph = graphBuilder.compile();

/**
 * Same graph, compiled with a `BaseCheckpointSaver` attached (typically
 * `createCheckpointer()`/`createAndSetupCheckpointer()` from
 * `./checkpointer-config`). Every invocation MUST pass a stable
 * `configurable.thread_id` — LangGraph uses it to key checkpoint rows, and
 * it's how a caller resumes the same run later (after a crash, after a
 * pause/interrupt once this graph grows one — see the module docblock scope
 * note: this graph has no interrupt node yet, so today "resume" just means
 * "the executed node's state was durably persisted", which is still real
 * value ahead of a future interrupt node landing here).
 *
 * Kept as a factory (not a second top-level singleton) because a
 * checkpointer owns a live `pg.Pool` — callers decide its lifecycle
 * (when to build it, when to `.end()` it), the graph module doesn't.
 */
export function compileCommercialProposalGraphWithCheckpointer(checkpointer: BaseCheckpointSaver) {
  return graphBuilder.compile({ checkpointer });
}
