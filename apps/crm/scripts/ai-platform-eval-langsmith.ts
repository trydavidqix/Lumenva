import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "langsmith";
import { z } from "zod";

const goldenCaseSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  input_events: z.array(z.unknown()),
  query: z.string().min(1),
  expected: z.object({
    must_include: z.array(z.string()),
    must_not_include: z.array(z.string()),
    authority_domain: z.string().min(1),
    risk: z.enum(["low", "medium", "high"]),
  }),
});

const goldenCasesSchema = z.array(goldenCaseSchema).min(25);

export type GoldenCase = z.infer<typeof goldenCaseSchema>;
export type Risk = GoldenCase["expected"]["risk"];

export const DETERMINISTIC_EVALUATOR_KEYS = [
  "tenant_marker",
  "required_content",
  "forbidden_content",
  "authority_domain",
  "risk",
  "secret_redaction",
  "fallback_behavior",
] as const;

type DeterministicEvaluatorKey = (typeof DETERMINISTIC_EVALUATOR_KEYS)[number];

export interface SyntheticExample {
  id: string;
  inputs: {
    case_id: string;
    organization_id: string;
    contact_id: string;
    query: string;
  };
  outputs: {
    must_include: string[];
    must_not_include: string[];
    authority_domain: string;
    risk: Risk;
    fallback_required: boolean;
  };
}

export interface SyntheticExampleUpload extends SyntheticExample {
  dataset_id: string;
}

export interface LangSmithDatasetClient {
  createDataset(name: string, options: { description: string }): Promise<{ id: string }>;
  createExamples(examples: SyntheticExampleUpload[]): Promise<unknown>;
}

export interface EvaluationOutput {
  response: string;
  authority_domain: string;
  risk: Risk;
  fallback: {
    used: boolean;
    reason?: string;
  };
}

export interface EvaluationResult {
  key: DeterministicEvaluatorKey | "llm_judge";
  score: 0 | 1;
}

export type LlmJudge = (input: { testCase: GoldenCase; output: EvaluationOutput }) => Promise<EvaluationResult>;

export interface RunLangSmithEvaluationOptions {
  cases?: GoldenCase[];
  execute?: (testCase: GoldenCase) => EvaluationOutput | Promise<EvaluationOutput>;
  client?: LangSmithDatasetClient;
  uploadDataset?: boolean;
  judge?: LlmJudge;
  enableLlmJudge?: boolean;
  judgeApiKey?: string;
}

const DATASET_NAME = "lumenva-ai-platform-golden-v1";
const DATASET_DESCRIPTION = "Synthetic offline evaluation cases for AI platform safety contracts.";
const FALLBACK_CASE_PATTERN = /(?:timeout|down)/i;
const SECRET_PATTERN = /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{6,}\b/;

export function loadGoldenCases(): GoldenCase[] {
  return goldenCasesSchema.parse(
    JSON.parse(readFileSync(resolve(process.cwd(), "apps/crm/tests/fixtures/ai-platform/golden-cases.json"), "utf8")),
  );
}

export function tenantMarker(organizationId: string): string {
  return `[tenant:${organizationId}]`;
}

export function requiresFallback(testCase: GoldenCase): boolean {
  return FALLBACK_CASE_PATTERN.test(testCase.id);
}

export function isSyntheticUploadRequested(argv: string[]): boolean {
  return argv.includes("--upload-synthetic");
}

export function createSyntheticExamples(cases: GoldenCase[]): SyntheticExample[] {
  return cases.map((testCase) => ({
    id: testCase.contact_id,
    inputs: {
      case_id: testCase.id,
      organization_id: testCase.organization_id,
      contact_id: testCase.contact_id,
      query: testCase.query,
    },
    outputs: {
      must_include: testCase.expected.must_include,
      must_not_include: testCase.expected.must_not_include,
      authority_domain: testCase.expected.authority_domain,
      risk: testCase.expected.risk,
      fallback_required: requiresFallback(testCase),
    },
  }));
}

export function buildSyntheticRunOutput(testCase: GoldenCase): EvaluationOutput {
  return {
    response: [tenantMarker(testCase.organization_id), ...testCase.expected.must_include].join(" "),
    authority_domain: testCase.expected.authority_domain,
    risk: testCase.expected.risk,
    fallback: requiresFallback(testCase) ? { used: true, reason: "dependency_unavailable" } : { used: false },
  };
}

export function evaluateDeterministic(testCase: GoldenCase, output: EvaluationOutput): EvaluationResult[] {
  const hasRequiredContent = testCase.expected.must_include.every((value) => output.response.includes(value));
  const hasForbiddenContent = testCase.expected.must_not_include.some((value) => output.response.includes(value));
  const fallbackRequired = requiresFallback(testCase);
  const fallbackCorrect = fallbackRequired
    ? output.fallback.used && output.fallback.reason === "dependency_unavailable"
    : !output.fallback.used;

  return [
    { key: "tenant_marker", score: output.response.includes(tenantMarker(testCase.organization_id)) ? 1 : 0 },
    { key: "required_content", score: hasRequiredContent ? 1 : 0 },
    { key: "forbidden_content", score: hasForbiddenContent ? 0 : 1 },
    { key: "authority_domain", score: output.authority_domain === testCase.expected.authority_domain ? 1 : 0 },
    { key: "risk", score: output.risk === testCase.expected.risk ? 1 : 0 },
    { key: "secret_redaction", score: SECRET_PATTERN.test(output.response) ? 0 : 1 },
    { key: "fallback_behavior", score: fallbackCorrect ? 1 : 0 },
  ];
}

export async function runLangSmithEvaluation(options: RunLangSmithEvaluationOptions = {}) {
  const cases = options.cases ?? loadGoldenCases();
  const execute = options.execute ?? buildSyntheticRunOutput;
  const caseResults = await Promise.all(
    cases.map(async (testCase) => {
      const output = await execute(testCase);
      const deterministic = evaluateDeterministic(testCase, output);
      const shouldRunJudge = options.enableLlmJudge === true && Boolean(options.judgeApiKey) && options.judge !== undefined;
      const judgeResult = shouldRunJudge ? [await options.judge!({ testCase, output })] : [];
      return { testCase, results: [...deterministic, ...judgeResult] };
    }),
  );

  if (options.uploadDataset) {
    if (options.client === undefined) throw new Error("A LangSmith client is required when uploadDataset is enabled.");
    const dataset = await options.client.createDataset(DATASET_NAME, { description: DATASET_DESCRIPTION });
    await options.client.createExamples(
      createSyntheticExamples(cases).map((example) => ({ ...example, dataset_id: dataset.id })),
    );
  }

  const failed = caseResults.filter((result) => result.results.some((evaluation) => evaluation.score === 0)).length;
  return {
    total: cases.length,
    failed,
    passed: cases.length - failed,
    mode: options.execute === undefined ? "synthetic_reference" : "evaluation_target",
    uploaded: options.uploadDataset === true,
    llm_judge_ran: options.enableLlmJudge === true && Boolean(options.judgeApiKey) && options.judge !== undefined,
    evaluator_keys: DETERMINISTIC_EVALUATOR_KEYS,
  };
}

async function main(): Promise<void> {
  const uploadRequested = isSyntheticUploadRequested(process.argv);
  if (uploadRequested && !process.env.LANGSMITH_API_KEY) {
    throw new Error("--upload-synthetic requires LANGSMITH_API_KEY.");
  }
  const uploadDataset = uploadRequested && Boolean(process.env.LANGSMITH_API_KEY);
  const client = uploadDataset ? (new Client({ apiKey: process.env.LANGSMITH_API_KEY }) as LangSmithDatasetClient) : undefined;
  const summary = await runLangSmithEvaluation({ client, uploadDataset });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main();
}
