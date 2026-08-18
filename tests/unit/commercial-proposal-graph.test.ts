import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  commercialProposalGraph,
  generateProposalNode,
  proposalDraftPayloadSchema,
  type ProposalGraphState,
} from "@/lib/workflows/commercial-proposal-graph";
import { runModelCall } from "@/lib/agent-engine/edge/llm/run-model-call";

vi.mock("@/lib/agent-engine/edge/llm/run-model-call", () => ({ runModelCall: vi.fn() }));

const mockRunModelCall = vi.mocked(runModelCall);

const db = {} as never;
const llmCfg = {} as never;

const BASE_STATE: ProposalGraphState = {
  organization_id: "org-1",
  contact_id: "contact-1",
  lead_id: "lead-1",
  conversation_id: "conv-1",
  crm_context: {
    contact_name: "Rafael Souza",
    company: "Acme Ltda",
    needs: "Precisa de um CRM com WhatsApp nativo para 5 vendedores.",
  },
  draft_payload: null,
  validation_errors: null,
  error: null,
};

const VALID_DRAFT = {
  proposal_title: "Proposta DeskcommCRM — Acme Ltda",
  executive_summary: "Resumo executivo da proposta para a Acme Ltda.",
  terms: "Plano mensal, sem fidelidade, suporte incluso.",
  next_steps: ["Agendar demo", "Confirmar número de assentos"],
};

function modelCallResult(text: string): Awaited<ReturnType<typeof runModelCall>> {
  return {
    result: { text },
    callId: "call-1",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    usage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
    costCents: 1,
    latencyMs: 100,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateProposalNode", () => {
  it("happy path: valid contact context produces a Zod-valid draft_payload", async () => {
    mockRunModelCall.mockResolvedValueOnce(modelCallResult(JSON.stringify(VALID_DRAFT)));

    const out = await generateProposalNode(BASE_STATE, { db, llmCfg });

    expect(out.error).toBeNull();
    expect(out.draft_payload).toEqual(VALID_DRAFT);
    expect(() => proposalDraftPayloadSchema.parse(out.draft_payload)).not.toThrow();

    // tenant/purpose threaded correctly into the single LLM seam — never a
    // fresh provider instance, never a missing/incorrect tenant id.
    expect(mockRunModelCall).toHaveBeenCalledTimes(1);
    const [, , input] = mockRunModelCall.mock.calls[0]!;
    expect(input.tenantId).toBe("org-1");
    expect(input.purpose).toBe("proposal_workflow_draft");
  });

  it("tolerates a ```json code fence around the model output", async () => {
    mockRunModelCall.mockResolvedValueOnce(
      modelCallResult("```json\n" + JSON.stringify(VALID_DRAFT) + "\n```"),
    );

    const out = await generateProposalNode(BASE_STATE, { db, llmCfg });

    expect(out.error).toBeNull();
    expect(out.draft_payload).toEqual(VALID_DRAFT);
  });

  it("LLM error (timeout/rate limit): catches and returns error state, no draft", async () => {
    mockRunModelCall.mockRejectedValueOnce(new Error("rate limit exceeded"));

    const out = await generateProposalNode(BASE_STATE, { db, llmCfg });

    expect(out.draft_payload).toBeUndefined();
    expect(out.error).toEqual({ code: "llm_call_failed", message: "rate limit exceeded" });
  });

  it("invalid contact data: missing crm_context returns error without calling the LLM", async () => {
    const state: ProposalGraphState = { ...BASE_STATE, crm_context: null };

    const out = await generateProposalNode(state, { db, llmCfg });

    expect(out.error?.code).toBe("invalid_contact_data");
    expect(out.draft_payload).toBeUndefined();
    expect(mockRunModelCall).not.toHaveBeenCalled();
  });

  it("invalid contact data: crm_context missing required 'needs' field returns error without calling the LLM", async () => {
    const state: ProposalGraphState = {
      ...BASE_STATE,
      crm_context: { contact_name: "Rafael", company: null, needs: "" } as never,
    };

    const out = await generateProposalNode(state, { db, llmCfg });

    expect(out.error?.code).toBe("invalid_contact_data");
    expect(mockRunModelCall).not.toHaveBeenCalled();
  });

  it("missing organization_id/contact_id returns error without calling the LLM", async () => {
    const state: ProposalGraphState = { ...BASE_STATE, organization_id: "" };

    const out = await generateProposalNode(state, { db, llmCfg });

    expect(out.error?.code).toBe("invalid_contact_data");
    expect(mockRunModelCall).not.toHaveBeenCalled();
  });

  it("malformed LLM JSON output returns invalid_llm_output error, not a thrown exception", async () => {
    mockRunModelCall.mockResolvedValueOnce(modelCallResult("desculpe, não posso ajudar com isso."));

    const out = await generateProposalNode(BASE_STATE, { db, llmCfg });

    expect(out.error?.code).toBe("invalid_llm_output");
    expect(out.draft_payload).toBeUndefined();
  });

  it("LLM output missing a required field returns invalid_llm_output error", async () => {
    const { next_steps: _dropped, ...incomplete } = VALID_DRAFT;
    mockRunModelCall.mockResolvedValueOnce(modelCallResult(JSON.stringify(incomplete)));

    const out = await generateProposalNode(BASE_STATE, { db, llmCfg });

    expect(out.error?.code).toBe("invalid_llm_output");
  });
});

describe("commercialProposalGraph", () => {
  it("wires START -> node_generate_proposal -> END and reaches the same result as the isolated node", async () => {
    mockRunModelCall.mockResolvedValueOnce(modelCallResult(JSON.stringify(VALID_DRAFT)));

    const out = await commercialProposalGraph.invoke(BASE_STATE, { configurable: { db, llmCfg } });

    expect(out.draft_payload).toEqual(VALID_DRAFT);
    expect(out.error).toBeNull();
  });

  it("throws a clear error when invoked without configurable db/llmCfg deps (fails closed)", async () => {
    await expect(commercialProposalGraph.invoke(BASE_STATE)).rejects.toThrow(/configurable\.db\/llmCfg/);
    expect(mockRunModelCall).not.toHaveBeenCalled();
  });
});
