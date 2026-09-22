import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { compileContext } from './compiler.mjs';

export const MEMORY_LAYERS = Object.freeze(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']);
export const MEMORY_STATUSES = Object.freeze(['CANDIDATE', 'VALIDATED', 'ACTIVE', 'STALE', 'SUPERSEDED', 'REJECTED', 'ARCHIVED']);
export const MEMORY_NAMESPACES = Object.freeze([
  'company/',
  'executive/claude/',
  'engineering/codex/',
  'intelligence/antigravity/',
  'episodic/jobs/',
  'projects/',
  'customers/'
]);

const LAYERS = new Set(MEMORY_LAYERS);
const STATUSES = new Set(MEMORY_STATUSES);
const PRIVATE_OWNERS = new Map([
  ['executive/claude/', 'claude'],
  ['engineering/codex/', 'codex'],
  ['intelligence/antigravity/', 'antigravity']
]);
const ACTIVE_RETRIEVAL = new Set(['ACTIVE', 'VALIDATED']);
const eventPath = root => join(root, 'state', 'memory', 'events.jsonl');
const retrievalPath = root => join(root, 'state', 'memory', 'retrieval.jsonl');

function stableHash(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

function namespacePrefix(namespace) {
  return MEMORY_NAMESPACES.find(prefix => String(namespace || '').startsWith(prefix)) || null;
}

function defaultNamespace(layer) {
  if (layer === 'L5') return 'projects/default/evidence/';
  if (layer === 'L4') return 'projects/default/decisions/';
  if (layer === 'L2') return 'episodic/jobs/general/';
  return 'projects/default/';
}

function defaultOwner(namespace) {
  const prefix = namespacePrefix(namespace);
  return PRIVATE_OWNERS.get(prefix) || (prefix === 'company/' ? 'company' : prefix === 'customers/' ? 'customer-ops' : 'project');
}

function actorCanWrite(namespace, actor = 'system') {
  if (actor === 'system' || actor === 'memory-os') return true;
  const prefix = namespacePrefix(namespace);
  const privateOwner = PRIVATE_OWNERS.get(prefix);
  return !privateOwner || actor === privateOwner;
}

function assertNamespace(namespace) {
  const prefix = namespacePrefix(namespace);
  if (!prefix) throw new Error(`unsupported memory namespace: ${namespace}`);
  return prefix;
}

function assertLayer(layer) {
  if (!LAYERS.has(layer)) throw new Error(`unsupported memory layer: ${layer}`);
}

function assertStatus(status) {
  if (!STATUSES.has(status)) throw new Error(`unsupported memory status: ${status}`);
}

async function readEvents(root) {
  try {
    return (await readFile(eventPath(root), 'utf8'))
      .split('\n')
      .filter(Boolean)
      .flatMap(line => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
  } catch {
    return [];
  }
}

async function appendMemoryEvent(root, action, memory, meta = {}) {
  await mkdir(join(root, 'state', 'memory'), { recursive: true, mode: 0o700 });
  const event = {
    event_id: `memevt-${randomUUID()}`,
    action,
    memory_id: memory.id,
    timestamp: new Date().toISOString(),
    actor: meta.actor || 'memory-os',
    reason: meta.reason || null,
    task_id: meta.task_id || null,
    trace_id: meta.trace_id || null,
    memory
  };
  await appendFile(eventPath(root), `${JSON.stringify(event)}\n`, { mode: 0o600 });
  return event;
}

async function currentMap(root) {
  const map = new Map();
  for (const event of await readEvents(root)) {
    if (event.memory?.id) map.set(event.memory.id, event.memory);
  }
  return map;
}

function contentTerms(value) {
  return [...new Set(String(value || '').toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(term => term.length >= 2))];
}

function relevance(memory, query) {
  if (!query) return { score: 1, reason: 'recent-active-memory' };
  const terms = contentTerms(query);
  if (!terms.length) return { score: 1, reason: 'recent-active-memory' };
  const haystack = `${memory.content || ''} ${memory.namespace} ${memory.source} ${memory.scope}`.toLowerCase();
  const matches = terms.filter(term => haystack.includes(term)).length;
  return {
    score: Number((matches / terms.length).toFixed(4)),
    reason: matches ? `${matches}/${terms.length} query terms matched` : 'no query term match'
  };
}

function expired(memory, now = Date.now()) {
  if (!Number.isFinite(memory.ttl) || memory.ttl <= 0) return false;
  const base = Date.parse(memory.updated_at || memory.created_at);
  return Number.isFinite(base) && base + memory.ttl * 1000 < now;
}

function normalizedRecord(record = {}, { allowCompany = false } = {}) {
  const now = new Date().toISOString();
  const layer = record.layer || 'L3';
  assertLayer(layer);
  const namespace = record.namespace || defaultNamespace(layer);
  const prefix = assertNamespace(namespace);
  const status = record.status || 'ACTIVE';
  assertStatus(status);
  if (prefix === 'company/' && !allowCompany) throw new Error('company memory requires validated promotion');
  const content = typeof record.content === 'string' ? record.content : JSON.stringify(record.content ?? '');
  const source = record.source || 'memory-os';
  const provenance = record.provenance ?? { source };
  const version = Number.isFinite(record.version) && record.version > 0 ? record.version : 1;
  return {
    id: String(record.id || `memory-${randomUUID()}`),
    layer,
    namespace,
    content,
    source,
    provenance,
    owner: record.owner || defaultOwner(namespace),
    scope: record.scope || (prefix === 'company/' ? 'company' : prefix === 'episodic/jobs/' ? 'job' : prefix === 'customers/' ? 'customer' : 'project'),
    status,
    created_at: record.created_at || now,
    updated_at: record.updated_at || now,
    last_used_at: record.last_used_at || null,
    supersedes: record.supersedes || null,
    superseded_by: record.superseded_by || null,
    ttl: Number.isFinite(record.ttl) ? record.ttl : null,
    retention_policy: record.retention_policy || (layer === 'L5' || layer === 'L4' ? 'archive' : 'standard'),
    sensitivity: record.sensitivity || 'internal',
    hash: record.hash || stableHash(content),
    version,
    confidence: record.confidence ?? null,
    evidence: Array.isArray(record.evidence) ? record.evidence : [],
    promoted_from: record.promoted_from || null,
    task_id: record.task_id || null,
    trace_id: record.trace_id || null,
    tags: Array.isArray(record.tags) ? [...new Set(record.tags.map(String))] : []
  };
}

export async function remember(root, record = {}, { actor = 'system' } = {}) {
  const memory = normalizedRecord(record);
  if (!actorCanWrite(memory.namespace, actor)) throw new Error(`actor ${actor} cannot write namespace ${memory.namespace}`);
  await appendMemoryEvent(root, 'CREATED', memory, { actor, task_id: memory.task_id, trace_id: memory.trace_id });
  return memory;
}

export async function getMemory(root, id) {
  return (await currentMap(root)).get(id) || null;
}

export async function recall(root, {
  layer,
  scope,
  namespace,
  status,
  query,
  top_k = 5,
  task_id = null,
  trace_id = null,
  include_candidates = false
} = {}) {
  if (layer) assertLayer(layer);
  if (status) assertStatus(status);
  if (namespace) assertNamespace(namespace);
  const current = [...(await currentMap(root)).values()];
  const ranked = current
    .filter(memory => !expired(memory))
    .filter(memory => !layer || memory.layer === layer)
    .filter(memory => !scope || memory.scope === scope)
    .filter(memory => !namespace || memory.namespace.startsWith(namespace))
    .filter(memory => status ? memory.status === status : (include_candidates ? !['REJECTED', 'ARCHIVED', 'SUPERSEDED'].includes(memory.status) : ACTIVE_RETRIEVAL.has(memory.status)))
    .map(memory => ({ memory, ...relevance(memory, query) }))
    .filter(item => !query || item.score > 0)
    .sort((left, right) => right.score - left.score || String(right.memory.updated_at).localeCompare(String(left.memory.updated_at)))
    .slice(0, Math.max(1, Math.min(Number(top_k) || 5, 5)));

  const now = new Date().toISOString();
  for (const item of ranked) {
    const memory = { ...item.memory, last_used_at: now };
    await appendMemoryEvent(root, 'RETRIEVED', memory, { actor: 'memory-os', task_id, trace_id });
    const audit = {
      retrieval_id: `retrieval-${randomUUID()}`,
      memory_id: memory.id,
      namespace: memory.namespace,
      source: memory.source,
      provenance: memory.provenance,
      score: item.score,
      reason: item.reason,
      timestamp: now,
      chars: memory.content.length,
      estimated_tokens: Math.ceil(memory.content.length / 4),
      cache_hit: false,
      task_id,
      trace_id
    };
    await mkdir(join(root, 'state', 'memory'), { recursive: true, mode: 0o700 });
    await appendFile(retrievalPath(root), `${JSON.stringify(audit)}\n`, { mode: 0o600 });
    item.memory = memory;
  }
  return ranked.map(item => item.memory);
}

export async function validateMemory(root, id, {
  actor = 'validator',
  evidence = [],
  task_id = null,
  trace_id = null
} = {}) {
  const current = await getMemory(root, id);
  if (!current) throw new Error(`memory not found: ${id}`);
  if (current.status !== 'CANDIDATE') throw new Error('only CANDIDATE memory can be validated');
  if (!Array.isArray(evidence) || evidence.length === 0) throw new Error('validation requires evidence');
  const allPass = evidence.every(item => String(item.status || '').toUpperCase() === 'PASS');
  const updated = {
    ...current,
    status: allPass ? 'VALIDATED' : 'REJECTED',
    evidence,
    confidence: {
      value: allPass ? 100 : null,
      measurement_type: allPass ? 'exact' : 'unavailable',
      evidence_count: evidence.length,
      source: 'validation evidence'
    },
    updated_at: new Date().toISOString(),
    version: current.version + 1
  };
  await appendMemoryEvent(root, allPass ? 'VALIDATED' : 'REJECTED', updated, { actor, task_id, trace_id });
  return updated;
}

export async function promoteMemory(root, id, {
  actor = 'validator',
  evidence = [],
  task_id = null,
  trace_id = null,
  company_path = 'company/knowledge/'
} = {}) {
  const sourceMemory = await getMemory(root, id);
  if (!sourceMemory) throw new Error(`memory not found: ${id}`);
  if (sourceMemory.status !== 'VALIDATED') throw new Error('memory must be VALIDATED before company promotion');
  const validationEvidence = evidence.length ? evidence : sourceMemory.evidence;
  if (!validationEvidence.length) throw new Error('company promotion requires evidence');
  assertNamespace(company_path);
  if (!company_path.startsWith('company/')) throw new Error('company promotion target must be company/');
  const companyMemory = normalizedRecord({
    id: `company-${randomUUID()}`,
    layer: sourceMemory.layer,
    namespace: company_path,
    content: sourceMemory.content,
    source: sourceMemory.source,
    provenance: {
      source_memory_id: sourceMemory.id,
      source: sourceMemory.source,
      provenance: sourceMemory.provenance,
      promoted_at: new Date().toISOString()
    },
    owner: 'company',
    scope: 'company',
    status: 'ACTIVE',
    retention_policy: sourceMemory.retention_policy,
    sensitivity: sourceMemory.sensitivity,
    evidence: validationEvidence,
    confidence: sourceMemory.confidence,
    promoted_from: sourceMemory.id,
    task_id,
    trace_id,
    tags: sourceMemory.tags
  }, { allowCompany: true });
  await appendMemoryEvent(root, 'PROMOTED', companyMemory, { actor, task_id, trace_id });
  return companyMemory;
}

export async function supersedeMemory(root, id, replacement, { actor = 'system' } = {}) {
  const current = await getMemory(root, id);
  if (!current) throw new Error(`memory not found: ${id}`);
  if (!actorCanWrite(current.namespace, actor)) throw new Error(`actor ${actor} cannot supersede namespace ${current.namespace}`);
  const next = normalizedRecord({
    ...replacement,
    layer: replacement.layer || current.layer,
    namespace: replacement.namespace || current.namespace,
    owner: replacement.owner || current.owner,
    scope: replacement.scope || current.scope,
    supersedes: current.id,
    status: replacement.status || 'ACTIVE'
  });
  if (!actorCanWrite(next.namespace, actor)) throw new Error(`actor ${actor} cannot write namespace ${next.namespace}`);
  const old = {
    ...current,
    status: 'SUPERSEDED',
    superseded_by: next.id,
    updated_at: new Date().toISOString(),
    version: current.version + 1
  };
  await appendMemoryEvent(root, 'SUPERSEDED', old, { actor });
  await appendMemoryEvent(root, 'CREATED', next, { actor });
  return { superseded: old, replacement: next };
}

export async function archiveMemory(root, id, { actor = 'system', reason = 'retention' } = {}) {
  const current = await getMemory(root, id);
  if (!current) throw new Error(`memory not found: ${id}`);
  if (!actorCanWrite(current.namespace, actor)) throw new Error(`actor ${actor} cannot archive namespace ${current.namespace}`);
  const archived = {
    ...current,
    status: 'ARCHIVED',
    updated_at: new Date().toISOString(),
    version: current.version + 1
  };
  await appendMemoryEvent(root, 'ARCHIVED', archived, { actor, reason });
  return archived;
}

export async function createHandoff(root, {
  job_id,
  from_agent,
  to_agent,
  goal,
  current_state,
  files_touched = [],
  decisions = [],
  evidence = [],
  tests = [],
  blockers = [],
  next_steps = [],
  task_id = null,
  trace_id = null
} = {}) {
  if (!job_id) throw new Error('handoff job_id is required');
  const payload = {
    job_id,
    from_agent: from_agent || null,
    to_agent: to_agent || null,
    goal: goal || '',
    current_state: current_state || '',
    files_touched,
    decisions,
    evidence,
    tests,
    blockers,
    next_steps,
    task_id,
    trace_id
  };
  return remember(root, {
    id: `handoff-${job_id}-${randomUUID().slice(0, 8)}`,
    layer: 'L2',
    namespace: `episodic/jobs/${job_id}/handoffs/`,
    scope: 'job',
    content: JSON.stringify(payload),
    source: 'memory-os.handoff',
    provenance: { from_agent, to_agent, task_id, trace_id },
    owner: from_agent || 'project',
    status: 'ACTIVE',
    retention_policy: 'archive',
    task_id,
    trace_id,
    tags: ['handoff']
  }, { actor: 'memory-os' });
}

export async function compileMemoryContext(root, {
  query,
  task_id = null,
  trace_id = null,
  namespaces = [],
  top_k_per_namespace = 3,
  budget_chars = Infinity,
  previous = []
} = {}) {
  const selectedNamespaces = namespaces.length ? namespaces : ['company/', 'projects/'];
  const unique = new Map();
  for (const namespace of selectedNamespaces) {
    const rows = await recall(root, {
      namespace,
      query,
      top_k: Math.max(1, Math.min(top_k_per_namespace, 5)),
      task_id,
      trace_id
    });
    for (const row of rows) unique.set(row.id, row);
  }
  const fragments = [...unique.values()].map(memory => ({
    id: `memory:${memory.id}`,
    category: memory.layer === 'L4' ? 'decisions' : memory.layer === 'L5' ? 'evidence' : memory.scope === 'project' ? 'project_memory' : 'recent',
    content: memory.content,
    source: memory.source,
    provenance: memory.provenance,
    scope: memory.scope,
    level: memory.layer,
    must_keep: memory.layer === 'L4' || memory.layer === 'L5'
  }));
  const compiled = compileContext({ fragments, budget_chars, previous });
  return {
    ...compiled,
    memory_ids: [...unique.keys()],
    retrieval_policy: {
      on_demand: true,
      namespaces: selectedNamespaces,
      top_k_per_namespace: Math.max(1, Math.min(top_k_per_namespace, 5))
    }
  };
}

export async function memoryEvents(root) {
  return readEvents(root);
}

export async function retrievalHistory(root) {
  try {
    return (await readFile(retrievalPath(root), 'utf8')).split('\n').filter(Boolean).map(JSON.parse);
  } catch {
    return [];
  }
}
