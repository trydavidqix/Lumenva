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

import { extractMemoryCandidates, type MemoryCandidate } from "@/lib/agent-engine/memory/extract";
import { llmEdgeConfigFromEnv } from "@/lib/agent-engine/edge/llm/run-model-call";
import { Mem0ContextProvider } from "@/lib/agent-engine/context/mem0-context-provider";
import { prepareSemanticContext } from "@/lib/agent-engine/context/fusion";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import type { SemanticMemoryRecord } from "@/lib/agent-engine/memory/types";

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

function candidateToRecord(
  candidate: MemoryCandidate,
  input: { organizationId: string; contactId: string; sourceId: string; sourceVersion: string; index: number; forceValidUntil?: string },
): SemanticMemoryRecord {
  return {
    id: `memory:${input.sourceId}:${input.index}`,
    organizationId: input.organizationId,
    contactId: input.contactId,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion,
    type: candidate.type,
    authorityDomain: candidate.authorityDomain,
    risk: candidate.risk,
    actionable: candidate.actionable,
    confidence: candidate.confidence,
    validFrom: candidate.validFrom ?? null,
    validUntil: input.forceValidUntil ?? candidate.validUntil ?? null,
    text: candidate.text,
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
  const llmConfig = llmEdgeConfigFromEnv({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, OPENAI_API_KEY: undefined, LLM_CACHE_TTL: undefined });
  const fakeDb = { query: async () => ({ rows: [] }) } as never;
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
  for (let i = 0; i < c.input_events.length; i++) {
    const event = c.input_events[i]!;
    try {
      const candidates = await extractMemoryCandidates(
        {
          db: fakeDb,
          llmConfig,
          organizationId: c.organization_id,
          contactId: c.contact_id,
          sourceMessageId: `eval-${c.id}-${i}`,
          sourceText: event.text,
        },
        { runModelCall: directRunModelCall as never },
      );
      for (const [idx, candidate] of candidates.entries()) {
        const record = candidateToRecord(candidate, {
          organizationId: c.organization_id,
          contactId: c.contact_id,
          sourceId: `eval-${c.id}-${i}`,
          sourceVersion: new Date(Date.now() + i * 1000).toISOString(),
          index: idx,
          forceValidUntil: event.forceValidUntil,
        });
        await memoryPort.upsert(record, `eval:${c.id}:${i}:${idx}`);
        candidateCount++;
      }
    } catch (err) {
      extractionErrors++;
      reasons.push(`extraction_error[${i}]: ${err instanceof Error ? err.message : String(err)}`);
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
