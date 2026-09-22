import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  archiveMemory,
  compileMemoryContext,
  createHandoff,
  getMemory,
  promoteMemory,
  recall,
  remember,
  retrievalHistory,
  supersedeMemory,
  validateMemory
} from '../src/context/memory.mjs';

const root = await mkdtemp(join(tmpdir(), 'mcg-memory-os-'));
try {
  const candidate = await remember(root, {
    id: 'architecture-candidate',
    layer: 'L4',
    namespace: 'engineering/codex/architecture/',
    content: 'Core and Desktop remain separate processes.',
    source: 'test',
    provenance: { artifact: 'adr-1' },
    status: 'CANDIDATE',
    owner: 'codex'
  }, { actor: 'codex' });
  assert.equal(candidate.status, 'CANDIDATE');

  await assert.rejects(
    () => remember(root, {
      layer: 'L3',
      namespace: 'engineering/codex/private/',
      content: 'forbidden write'
    }, { actor: 'claude' }),
    /cannot write namespace/
  );
  await assert.rejects(
    () => remember(root, {
      layer: 'L3',
      namespace: 'company/knowledge/',
      content: 'bypass'
    }),
    /requires validated promotion/
  );

  const validated = await validateMemory(root, candidate.id, {
    evidence: [{ id: 'e1', status: 'PASS' }],
    actor: 'validator'
  });
  assert.equal(validated.status, 'VALIDATED');
  assert.equal(validated.confidence.measurement_type, 'exact');

  const company = await promoteMemory(root, candidate.id, { actor: 'validator' });
  assert.equal(company.namespace.startsWith('company/'), true);
  assert.equal(company.promoted_from, candidate.id);
  assert.equal(company.status, 'ACTIVE');

  const privateRows = await recall(root, {
    namespace: 'engineering/codex/',
    query: 'Desktop separate',
    top_k: 3,
    task_id: 'task-1',
    trace_id: 'trace-1'
  });
  assert.equal(privateRows.length, 1);
  const retrievals = await retrievalHistory(root);
  assert.equal(retrievals.at(-1).memory_id, candidate.id);
  assert.equal(retrievals.at(-1).task_id, 'task-1');

  const handoff = await createHandoff(root, {
    job_id: 'job-1',
    from_agent: 'claude',
    to_agent: 'codex',
    goal: 'Implement storage',
    current_state: 'Memory validated',
    files_touched: ['src/context/memory.mjs'],
    evidence: ['e1'],
    tests: ['memory-os.test'],
    next_steps: ['HistoryStore']
  });
  assert.equal(handoff.namespace.startsWith('episodic/jobs/job-1/'), true);

  const base = await remember(root, {
    id: 'project-old',
    layer: 'L3',
    namespace: 'projects/lumenva/',
    content: 'old architecture',
    source: 'test'
  });
  const replaced = await supersedeMemory(root, base.id, {
    id: 'project-new',
    content: 'new architecture'
  });
  assert.equal(replaced.superseded.status, 'SUPERSEDED');
  assert.equal((await getMemory(root, base.id)).superseded_by, 'project-new');

  const compiled = await compileMemoryContext(root, {
    query: 'architecture Desktop',
    namespaces: ['company/', 'projects/'],
    top_k_per_namespace: 2,
    budget_chars: 10_000
  });
  assert.equal(compiled.retrieval_policy.on_demand, true);
  assert.ok(compiled.memory_ids.includes(company.id));

  const archived = await archiveMemory(root, 'project-new');
  assert.equal(archived.status, 'ARCHIVED');
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log('memory OS tests: 1 passed');
