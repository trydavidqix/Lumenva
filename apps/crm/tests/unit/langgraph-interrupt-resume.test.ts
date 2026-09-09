/**
 * Phase 7 LangGraph pilot — checkpointer interrupt/resume proof (session
 * Task 4; see `lib/workflows/checkpointer-config.ts`'s scope note and
 * `.superpowers/sdd/2026-08-10-ai-platform-phase-7-langgraph/task-4-report.md`).
 *
 * WHY A STANDALONE PROBE GRAPH, NOT `commercial-proposal-graph.ts`:
 * that graph (session Task 3) is `START -> node_generate_proposal -> END` —
 * a single node, no interrupt yet (its own docblock says so explicitly).
 * There is nothing to pause mid-execution there. This suite proves the
 * checkpointer mechanics generically — a minimal, self-contained graph with
 * an async "LLM call" node and an `interrupt()`-ing "human approval" node —
 * against a REAL, ephemeral Postgres (via Docker, `pgvector/pgvector:pg17`,
 * same image `scripts/test-db.sh` uses). That's what proves durability
 * (survives closing the pool / "process restart"), not a `MemorySaver`
 * stand-in, which loses state by construction.
 *
 * WHY THIS LIVES UNDER `tests/unit/` BUT DEGRADES INSTEAD OF FAILING WITHOUT
 * DOCKER: `.claude/rules/testing-verification.md` documents `test:unit` as
 * NOT proving banco/RLS — `test:db` (tests/invariants/**) owns that. This
 * suite's subject really is banco-dependent (proving Postgres-backed
 * persistence is the whole point), so running `pnpm test:unit` on a machine
 * without Docker must stay green rather than red for an environmental
 * reason unrelated to the code. The Docker/Postgres bring-up below runs at
 * module load (top-level await) so the skip decision is known BEFORE
 * `describe`/`it` are registered — vitest's `skipIf` is evaluated at
 * collection time, not inside `beforeAll`. When Docker is reachable, every
 * assertion runs for real against a throwaway container removed at the end;
 * nothing here ever touches `SUPABASE_DB_URL`/any shared database.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

import {
  Annotation,
  Command,
  END,
  START,
  StateGraph,
  interrupt,
  type BaseCheckpointSaver,
} from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

import { createAndSetupCheckpointer } from '@/lib/workflows/checkpointer-config';

const execFileAsync = promisify(execFile);

// ─── Probe graph: load_context -> call_llm -> await_human_decision[interrupt] -> END ───

const ProbeState = Annotation.Root({
  input: Annotation<string>(),
  contextLoaded: Annotation<boolean>({ reducer: (_p, n) => n, default: () => false }),
  llmResponse: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
  decision: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
});
type ProbeStateType = typeof ProbeState.State;

interface ProbeCounters {
  loadContextCalls: number;
  llmCalls: number;
}

/** Fresh counters + a freshly-built graph per test, so call counts never leak across tests. */
function buildProbeGraph(counters: ProbeCounters, checkpointer: BaseCheckpointSaver) {
  return new StateGraph(ProbeState)
    .addNode('load_context', () => {
      counters.loadContextCalls += 1;
      return { contextLoaded: true };
    })
    .addNode('call_llm', async (state: ProbeStateType) => {
      counters.llmCalls += 1;
      // Simulates real LLM latency — proves the checkpoint that follows
      // reflects a genuinely-awaited async step, not a synchronous stub.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { llmResponse: `resposta-para:${state.input}` };
    })
    .addNode('await_human_decision', (state: ProbeStateType) => {
      const resume = interrupt<{ draft: string | null }, string>({ draft: state.llmResponse });
      return { decision: resume };
    })
    .addEdge(START, 'load_context')
    .addEdge('load_context', 'call_llm')
    .addEdge('call_llm', 'await_human_decision')
    .addEdge('await_human_decision', END)
    .compile({ checkpointer });
}

// ─── Ephemeral Postgres (Docker) — same image/pattern as scripts/test-db.sh ───
// Runs at module load (top-level await): vitest evaluates `skipIf` at test
// COLLECTION time, before any `beforeAll` runs, so the availability check
// has to finish before `describe`/`it` are registered below.

const CONTAINER_NAME = `langgraph-checkpointer-test-${randomUUID().slice(0, 8)}`;
const IMAGE = 'pgvector/pgvector:pg17';
const schema = `langgraph_test_${randomUUID().replace(/-/g, '_')}`;

async function dockerReachable(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['info'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function startEphemeralPostgres(): Promise<string | null> {
  try {
    await execFileAsync('docker', [
      'run',
      '-d',
      '--rm',
      '--name',
      CONTAINER_NAME,
      '-p',
      '127.0.0.1::5432',
      '-e',
      'POSTGRES_PASSWORD=postgres',
      '-e',
      'POSTGRES_DB=postgres',
      IMAGE,
    ]);
  } catch {
    return null;
  }

  // Poll readiness via TCP through the container's own psql (avoids the
  // false-ready initdb-socket-only phase — same guard scripts/test-db.sh uses).
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await execFileAsync('docker', [
        'exec',
        CONTAINER_NAME,
        'psql',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        'select 1',
      ]);
      const portOutput = execFileSync('docker', ['port', CONTAINER_NAME, '5432']).toString().trim();
      // e.g. "127.0.0.1:32768"
      const port = portOutput.split(':').pop();
      if (!port) return null;
      return `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return null;
}

function stopEphemeralPostgres(): void {
  try {
    execFileSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'ignore' });
  } catch {
    // best-effort teardown; --rm already cleans up on normal container stop
  }
}

const dockerOk = await dockerReachable();
const connectionString = dockerOk ? await startEphemeralPostgres() : null;
const dbAvailable = connectionString !== null;

afterAll(() => {
  if (dbAvailable) stopEphemeralPostgres();
});

if (!dbAvailable) {
  console.warn(
    'langgraph-interrupt-resume.test.ts: Docker/Postgres unreachable — the DB-backed suite ' +
      'was skipped (test:unit never fails for this reason per ' +
      '.claude/rules/testing-verification.md; the same suite runs fully in any environment ' +
      'with Docker available).',
  );
}

it('SETUP GUARD: records whether the Docker-backed suite ran or was skipped', () => {
  expect(typeof dbAvailable).toBe('boolean');
});

describe.skipIf(!dbAvailable)('LangGraph checkpointer — interrupt/resume against real Postgres', () => {
  it(
    'happy path: invoke pauses at the human-approval interrupt, checkpoint persists, resume continues',
    async () => {
      const threadId = randomUUID();
      const checkpointer = await createAndSetupCheckpointer({ connectionString: connectionString!, schema });
      const counters: ProbeCounters = { loadContextCalls: 0, llmCalls: 0 };
      const graph = buildProbeGraph(counters, checkpointer);
      const config = { configurable: { thread_id: threadId } };

      const paused = await graph.invoke({ input: 'proposta-a' }, config);

      // Paused, not finished: the interrupt payload comes back on __interrupt__
      // instead of a thrown exception (LangGraph's documented invoke() contract).
      expect(paused.decision).toBeNull();
      expect(paused.llmResponse).toBe('resposta-para:proposta-a');
      expect((paused as { __interrupt__?: Array<{ value: unknown }> }).__interrupt__).toBeDefined();
      expect((paused as { __interrupt__?: Array<{ value: unknown }> }).__interrupt__?.[0]?.value).toEqual({
        draft: 'resposta-para:proposta-a',
      });

      // The checkpoint genuinely landed in Postgres — read it back via a
      // BRAND NEW PostgresSaver/pool pointed at the same DB+schema, not the
      // instance that just wrote it.
      const reader = await createAndSetupCheckpointer({ connectionString: connectionString!, schema });
      const readerGraph = buildProbeGraph({ loadContextCalls: 0, llmCalls: 0 }, reader);
      const stateFromDisk = await readerGraph.getState(config);
      expect(stateFromDisk.next).toEqual(['await_human_decision']);
      await reader.end();

      const resumed = await graph.invoke(new Command({ resume: 'approved' }), config);
      expect(resumed.decision).toBe('approved');
      expect(resumed.llmResponse).toBe('resposta-para:proposta-a');

      await checkpointer.end();
    },
    30_000,
  );

  it(
    'resumes from the exact checkpoint after the LLM call — call_llm never re-runs on resume',
    async () => {
      const threadId = randomUUID();
      const checkpointer = await createAndSetupCheckpointer({ connectionString: connectionString!, schema });
      const counters: ProbeCounters = { loadContextCalls: 0, llmCalls: 0 };
      const graph = buildProbeGraph(counters, checkpointer);
      const config = { configurable: { thread_id: threadId } };

      await graph.invoke({ input: 'proposta-b' }, config);
      expect(counters.loadContextCalls).toBe(1);
      expect(counters.llmCalls).toBe(1);

      const resumed = await graph.invoke(new Command({ resume: 'approved' }), config);

      // Resume picked up AFTER call_llm — neither upstream node re-executed.
      expect(counters.loadContextCalls).toBe(1);
      expect(counters.llmCalls).toBe(1);
      expect(resumed.decision).toBe('approved');
      expect(resumed.llmResponse).toBe('resposta-para:proposta-b');

      await checkpointer.end();
    },
    30_000,
  );

  it(
    'multiple threads: different thread_ids maintain fully separate, non-interfering state',
    async () => {
      const checkpointer = await createAndSetupCheckpointer({ connectionString: connectionString!, schema });
      const counters: ProbeCounters = { loadContextCalls: 0, llmCalls: 0 };
      const graph = buildProbeGraph(counters, checkpointer);

      const threadA = { configurable: { thread_id: randomUUID() } };
      const threadB = { configurable: { thread_id: randomUUID() } };

      await graph.invoke({ input: 'thread-a' }, threadA);
      await graph.invoke({ input: 'thread-b' }, threadB);

      const stateA = await graph.getState(threadA);
      const stateB = await graph.getState(threadB);
      expect(stateA.values.llmResponse).toBe('resposta-para:thread-a');
      expect(stateB.values.llmResponse).toBe('resposta-para:thread-b');

      // Resolving A does not touch B.
      const resolvedA = await graph.invoke(new Command({ resume: 'approved-a' }), threadA);
      expect(resolvedA.decision).toBe('approved-a');

      const stateBAfter = await graph.getState(threadB);
      expect(stateBAfter.next).toEqual(['await_human_decision']);
      expect(stateBAfter.values.decision).toBeNull();
      expect(stateBAfter.values.llmResponse).toBe('resposta-para:thread-b');

      const resolvedB = await graph.invoke(new Command({ resume: 'approved-b' }), threadB);
      expect(resolvedB.decision).toBe('approved-b');
      // B's resume value never leaked into A during A's own resume.
      expect(resolvedA.decision).toBe('approved-a');

      await checkpointer.end();
    },
    30_000,
  );

  it(
    'restart simulation: closing the checkpointer pool and building a brand new one still resumes the same thread',
    async () => {
      const threadId = randomUUID();
      const config = { configurable: { thread_id: threadId } };

      // "Process A": interrupts, then the pool is explicitly closed —
      // nothing about instance A survives in memory afterward.
      const checkpointerA = await createAndSetupCheckpointer({ connectionString: connectionString!, schema });
      const countersA: ProbeCounters = { loadContextCalls: 0, llmCalls: 0 };
      const graphA = buildProbeGraph(countersA, checkpointerA);
      const pausedA = await graphA.invoke({ input: 'restart-case' }, config);
      expect(pausedA.decision).toBeNull();
      await checkpointerA.end();

      // "Process B": a fresh PostgresSaver, a fresh pool, a fresh compiled
      // graph instance — the only thing shared with "process A" is the
      // Postgres database + schema the checkpoint rows live in.
      const checkpointerB: PostgresSaver = await createAndSetupCheckpointer({
        connectionString: connectionString!,
        schema,
      });
      const countersB: ProbeCounters = { loadContextCalls: 0, llmCalls: 0 };
      const graphB = buildProbeGraph(countersB, checkpointerB);

      const stateFromB = await graphB.getState(config);
      expect(stateFromB.next).toEqual(['await_human_decision']);
      expect(stateFromB.values.llmResponse).toBe('resposta-para:restart-case');

      const resumedByB = await graphB.invoke(new Command({ resume: 'approved-after-restart' }), config);
      expect(resumedByB.decision).toBe('approved-after-restart');
      // Process B never re-ran load_context/call_llm — it only continued
      // from the persisted checkpoint written by process A.
      expect(countersB.loadContextCalls).toBe(0);
      expect(countersB.llmCalls).toBe(0);

      await checkpointerB.end();
    },
    30_000,
  );
});
