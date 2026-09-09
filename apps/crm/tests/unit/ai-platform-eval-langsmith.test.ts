import { describe, expect, it, vi } from "vitest";

import {
  DETERMINISTIC_EVALUATOR_KEYS,
  buildSyntheticRunOutput,
  createSyntheticExamples,
  evaluateDeterministic,
  isSyntheticUploadRequested,
  loadGoldenCases,
  runLangSmithEvaluation,
  type LangSmithDatasetClient,
} from "../../scripts/ai-platform-eval-langsmith";

describe("AI platform LangSmith-compatible evaluation runner", () => {
  it("derives stable synthetic example IDs and input/output keys from the golden dataset", () => {
    const examples = createSyntheticExamples(loadGoldenCases());

    // Not a fixed snapshot count — see tests/unit/ai-platform-eval.test.ts's
    // comment: the golden fixture is designed to grow (schema .min(25)) and
    // has already grown once. Only the first case's identity is pinned below.
    expect(examples.length).toBeGreaterThanOrEqual(25);
    expect(examples[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000101",
      inputs: {
        case_id: "preference-001",
        organization_id: "00000000-0000-4000-8000-000000000001",
        contact_id: "00000000-0000-4000-8000-000000000101",
        query: "preferência correta",
      },
      outputs: {
        authority_domain: "customer_preference",
        risk: "low",
      },
    });
    expect(Object.keys(examples[0]!.inputs)).toEqual(["case_id", "organization_id", "contact_id", "query"]);
    expect(Object.keys(examples[0]!.outputs)).toEqual(["must_include", "must_not_include", "authority_domain", "risk", "fallback_required"]);
    expect(new Set(examples.map((example) => example.id)).size).toBe(examples.length);
  });

  it("returns the deterministic evaluator keys in a stable order and detects unsafe output", () => {
    const testCase = {
      ...loadGoldenCases().find((item) => item.id === "secret-redaction-007")!,
      expected: {
        must_include: ["somente conteúdo permitido"],
        must_not_include: ["sk-"],
        authority_domain: "legal",
        risk: "high" as const,
      },
    };
    const output = {
      ...buildSyntheticRunOutput(testCase),
      response: "[tenant:wrong-tenant] sk-synthetic-secret",
      authority_domain: "relationship",
      risk: "low" as const,
      fallback: { used: true, reason: "unexpected" },
    };

    const results = evaluateDeterministic(testCase, output);

    expect(results.map((result) => result.key)).toEqual(DETERMINISTIC_EVALUATOR_KEYS);
    expect(results.map((result) => result.score)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("runs offline by default without calling a LangSmith client or an optional LLM judge", async () => {
    const client: LangSmithDatasetClient = {
      createDataset: vi.fn(),
      createExamples: vi.fn(),
    };
    const judge = vi.fn();
    const network = vi.fn();
    vi.stubGlobal("fetch", network);

    const summary = await runLangSmithEvaluation({ client, judge });

    // total mirrors the golden fixture's current length (loaded by
    // runLangSmithEvaluation itself when no `cases` override is given) rather
    // than a pinned literal — see the growth-not-a-snapshot comment above.
    expect(summary).toMatchObject({
      total: loadGoldenCases().length,
      failed: 0,
      uploaded: false,
      llm_judge_ran: false,
    });
    expect(client.createDataset).not.toHaveBeenCalled();
    expect(client.createExamples).not.toHaveBeenCalled();
    expect(judge).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("scores the supplied evaluation target instead of deriving a passing result from the golden expectation", async () => {
    const testCase = loadGoldenCases().find((item) => item.id === "secret-redaction-007")!;

    const summary = await runLangSmithEvaluation({
      cases: [testCase],
      execute: async () => ({
        response: "[tenant:wrong-tenant] sk-synthetic-secret",
        authority_domain: "relationship",
        risk: "low",
        fallback: { used: true, reason: "unexpected" },
      }),
    });

    expect(summary).toMatchObject({ total: 1, failed: 1, passed: 0, mode: "evaluation_target" });
  });

  it("requires an explicit command argument before a synthetic upload is requested", () => {
    expect(isSyntheticUploadRequested(["node", "script.ts"])).toBe(false);
    expect(isSyntheticUploadRequested(["node", "script.ts", "--upload-synthetic"])).toBe(true);
  });

  it("uploads only caller-provided synthetic examples through an injected fake client", async () => {
    const client: LangSmithDatasetClient = {
      createDataset: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000999" }),
      createExamples: vi.fn().mockResolvedValue([]),
    };

    const summary = await runLangSmithEvaluation({ client, uploadDataset: true });

    expect(summary.uploaded).toBe(true);
    expect(client.createDataset).toHaveBeenCalledWith("deskcomm-ai-platform-golden-v1", {
      description: "Synthetic offline evaluation cases for AI platform safety contracts.",
    });
    expect(client.createExamples).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "00000000-0000-4000-8000-000000000101",
          dataset_id: "00000000-0000-4000-8000-000000000999",
        }),
      ]),
    );
  });
});
