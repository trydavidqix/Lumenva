/**
 * Live Golden Dataset run — real extraction, real fusion, no mocks.
 *
 * `pnpm ai:eval:local` only validates the fixture's schema/uniqueness: it
 * never calls a model, so it proves nothing about extraction quality and
 * stays runnable without a provider key (CI-safe by design). This script is
 * the other half — it actually calls `extractMemoryCandidates` with a real
 * ANTHROPIC_API_KEY, upserts the results into an in-memory Mem0 fake,
 * retrieves through the real `Mem0ContextProvider`, and fuses through the
 * real `fuseContext` — the full live pipeline, for every case whose
 * `input_events` is non-empty.
 *
 * Deliberately NOT wired into `pnpm test:unit`/CI: it costs money and calls
 * a live third-party API on every run, which doctrine (`.claude/rules/`)
 * does not allow for the default test suite.
 *
 * Usage: ANTHROPIC_API_KEY=... pnpm exec tsx scripts/ai-platform-eval-live.ts
 */
import { readFileSync } from "node:fs";

import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

import { extractMemoryCandidates } from "@/lib/agent-engine/memory/extract";
import { llmEdgeConfigFromEnv } from "@/lib/agent-engine/edge/llm/run-model-call";
import { Mem0ContextProvider } from "@/lib/agent-engine/context/mem0-context-provider";
import { prepareSemanticContext } from "@/lib/agent-engine/context/fusion";
import { projectMessage } from "@/lib/agent-engine/memory/project-message";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import type { SemanticMemoryRecord } from "@/lib/agent-engine/memory/types";

type LedgerRow = { id: string; organization_id: string; idempotency_key: string; status: string };

/** Minimal in-memory stand-in for the ai_projection_ledger statements project-message.ts issues — same pattern as tests/unit/mem0-lifecycle-replay-proof.test.ts. */
function fakeLedgerDb() {
  const rows = new Map<string, LedgerRow>();
  let seq = 0;
  return {
    query: async (sql: string, values: unknown[]) => {
      if (sql.startsWith("insert into ai_projection_ledger")) {
        const [organizationId, , , , , , , idempotencyKey] = values as string[];
        const key = `${organizationId}:${idempotencyKey}`;
        const existing = rows.get(key);
        if (existing) return { rows: [{ id: existing.id, status: existing.status }] };
        const id = `ledger-${++seq}`;
        rows.set(key, { id, organization_id: organizationId!, idempotency_key: idempotencyKey!, status: "pending" });
        return { rows: [{ id, status: "pending" }] };
      }
      if (sql.includes("status = 'applied'")) {
        const [id, organizationId] = values as string[];
        const row = [...rows.values()].find((r) => r.id === id && r.organization_id === organizationId);
        if (row) row.status = "applied";
        return { rows: row ? [{ id: row.id, status: row.status }] : [] };
      }
      return { rows: [] };
    },
  };
}

const inputEventSchema = z.object({
  text: z.string().min(1),
  /** Only for the expired-memory scenario: lets a live-extracted candidate be aged past its validity without needing the model to emit an exact past ISO date, which is not reliable prompt engineering. */
  forceValidUntil: z.string().datetime({ offset: true }).optional(),
});

const caseSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  input_events: z.array(inputEventSchema),
  query: z.string().min(1),
  expected: z.object({
    must_include: z.array(z.string()),
    must_not_include: z.array(z.string()),
    authority_domain: z.string().min(1),
    risk: z.enum(["low", "medium", "high"]),
    /** Cases that assert absence (secrets, PII) instead of presence. */
    expect_zero_candidates: z.boolean().optional(),
    /** Runs the case at feature mode "on" instead of "shadow" — for cases that assert prompt-safety (promptBlock), which only exists at bucket=candidate. */
    bucket: z.enum(["shadow", "candidate"]).optional(),
  }),
});
const casesFileSchema = z.array(caseSchema);

function fakeMemoryPort(): MemoryPort {
  const store = new Map<string, SemanticMemoryRecord>();
  return {
    async upsert(record) {
      store.set(record.id, record);
    },
    async search(input) {
      return [...store.values()].filter((r) => r.organizationId === input.organizationId && r.contactId === input.contactId);
    },
    async deleteContact() {
      // not exercised here
    },
    async health() {
      return { ok: true, latencyMs: 0 };
    },
  };
}

type CaseResult = {
  id: string;
  ok: boolean;
  reasons: string[];
  candidateCount: number;
  extractionErrors: number;
};

async function runCase(c: z.infer<typeof caseSchema>): Promise<CaseResult> {
  const reasons: string[] = [];
  const memoryPort = fakeMemoryPort();
  const ledgerDb = fakeLedgerDb();
  const llmConfig = llmEdgeConfigFromEnv({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, OPENAI_API_KEY: undefined, LLM_CACHE_TTL: undefined });
  const model = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })("claude-sonnet-5");
  // extractMemoryCandidates's default runModelCall resolves org-level LLM
  // config (model/budget/provider) from a real `organizations` row via
  // resolveOrgLlmConfig — a real, already-proven-elsewhere concern this eval
  // isn't testing. These synthetic org/contact ids don't exist in any real
  // database, so bypass that resolution and call the model directly; this
  // eval is about extraction/fusion correctness, not org-config plumbing.
  const directRunModelCall = async (_db: unknown, _cfg: unknown, input: { messages: Array<{ role: "user"; content: string }> }) => {
    const result = await generateText({ model, messages: input.messages });
    return { result: { text: result.text } };
  };

  let candidateCount = 0;
  let extractionErrors = 0;
  // Sequential, on purpose: message N+1's extraction needs to see what
  // projecting message N actually stored (that's the whole point of
  // supersession detection), so these can't run concurrently.
  for (let i = 0; i < c.input_events.length; i++) {
    const event = c.input_events[i]!;
    const extractWithOverride = async (extractInput: Parameters<typeof extractMemoryCandidates>[0]) => {
      const candidates = await extractMemoryCandidates(extractInput, { runModelCall: directRunModelCall as never });
      return event.forceValidUntil ? candidates.map((cand) => ({ ...cand, validUntil: event.forceValidUntil })) : candidates;
    };
    const result = await projectMessage({
      db: ledgerDb as never,
      llmConfig,
      memoryPort,
      organizationId: c.organization_id,
      contactId: c.contact_id,
      message: { id: `eval-${c.id}-${i}`, body: event.text, created_at: new Date(Date.now() + i * 1000).toISOString() },
      extract: extractWithOverride,
    });
    if (result.status === "ok") candidateCount++;
    else if (result.status !== "skipped") {
      extractionErrors++;
      reasons.push(`event[${i}]: ${result.status} — ${result.detail}`);
    }
  }

  if (c.expected.expect_zero_candidates) {
    const ok = candidateCount === 0;
    if (!ok) reasons.push(`expected zero candidates, got ${candidateCount}`);
    return { id: c.id, ok, reasons, candidateCount, extractionErrors };
  }

  const mode = c.expected.bucket === "candidate" ? "on" : "shadow";
  const provider = new Mem0ContextProvider({
    memory: memoryPort,
    resolveFeature: async () => ({ mode, config: {}, killed: false }),
  });
  const result = await provider.retrieve({
    organizationId: c.organization_id,
    contactId: c.contact_id,
    conversationId: "00000000-0000-4000-8000-000000000999",
    agentId: "00000000-0000-4000-8000-000000000998",
    query: c.query,
    now: new Date().toISOString(),
  });
  const prepared = prepareSemanticContext(result, 300, Date.now());

  const measuredText = prepared.fusion.selected.map((item) => item.text).join(" | ");
  const promptText = prepared.promptBlock;
  const haystack = mode === "candidate" ? promptText : measuredText;

  for (const needle of c.expected.must_include) {
    if (!measuredText.includes(needle)) reasons.push(`missing must_include: "${needle}" (measured: ${measuredText || "<empty>"})`);
  }
  for (const needle of c.expected.must_not_include) {
    if (haystack.includes(needle)) reasons.push(`found forbidden must_not_include: "${needle}"`);
  }
  if (mode === "candidate" && c.expected.risk === "high") {
    if (promptText !== "") reasons.push(`high-risk/consent fact leaked into promptBlock: ${promptText}`);
  }

  return { id: c.id, ok: reasons.length === 0, reasons, candidateCount, extractionErrors };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set — this script requires a real key.");
    process.exitCode = 1;
    return;
  }
  const cases = casesFileSchema.parse(
    JSON.parse(readFileSync(new URL("../tests/fixtures/ai-platform/golden-cases.json", import.meta.url), "utf8")),
  );
  const populated = cases.filter((c) => c.input_events.length > 0 || c.expected.expect_zero_candidates);

  const results: CaseResult[] = [];
  for (const c of populated) {
    const r = await runCase(c);
    results.push(r);
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id}${r.ok ? "" : "\n  " + r.reasons.join("\n  ")}`);
  }

  const summary = {
    total_populated: populated.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    status: results.every((r) => r.ok) ? "pass" : "fail",
  };
  console.log(JSON.stringify(summary));
  if (summary.status !== "pass") process.exitCode = 1;
}

main();
