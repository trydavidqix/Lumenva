import { createHash } from 'node:crypto';

const LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
const DEFAULT_PRIORITY = { must_keep: 100, constraints: 98, decisions: 95, acceptance_criteria: 90, evidence: 85, recent: 70, unresolved: 80, project_memory: 60, historical: 30, disposable: 10 };

const hash = value => createHash('sha256').update(String(value ?? '')).digest('hex');

export function normalizeFragment(fragment = {}) {
  const category = fragment.category || fragment.classification || 'recent';
  const content = typeof fragment.content === 'string' ? fragment.content : JSON.stringify(fragment.content ?? '');
  return {
    id: String(fragment.id || `fragment-${hash(content).slice(0, 12)}`),
    hash: fragment.hash || hash(content),
    content,
    category,
    priority: Number.isFinite(fragment.priority) ? fragment.priority : (DEFAULT_PRIORITY[category] ?? 50),
    source: fragment.source || 'context.compiler',
    timestamp: fragment.timestamp || new Date().toISOString(),
    provenance: fragment.provenance || null,
    scope: fragment.scope || 'task',
    level: LEVELS.includes(fragment.level) ? fragment.level : 'L1',
    must_keep: fragment.must_keep === true || category === 'must_keep' || (Number.isFinite(fragment.priority) && fragment.priority >= 100)
  };
}

export function diffContext(previous = [], next = []) {
  const before = new Map(previous.map(item => [item.id, normalizeFragment(item)]));
  const after = new Map(next.map(item => [item.id, normalizeFragment(item)]));
  const added = [...after.values()].filter(item => !before.has(item.id));
  const removed = [...before.values()].filter(item => !after.has(item.id));
  const changed = [...after.values()].filter(item => before.has(item.id) && before.get(item.id).hash !== item.hash).map(item => ({ before: before.get(item.id), after: item }));
  const unchanged = [...after.values()].filter(item => before.has(item.id) && before.get(item.id).hash === item.hash);
  return { added, removed, changed, unchanged, delta_chars: added.concat(changed.map(item => item.after)).reduce((sum, item) => sum + item.content.length, 0) };
}

export function compileContext({ fragments = [], budget_chars = Infinity, previous = [], context_version = null } = {}) {
  const normalized = deduplicateFragments(fragments.map(normalizeFragment));
  const mustKeep = normalized.filter(item => item.must_keep).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const optional = normalized.filter(item => !item.must_keep).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const selected = [...mustKeep];
  let chars = selected.reduce((sum, item) => sum + item.content.length, 0);
  for (const item of optional) {
    if (chars + item.content.length <= budget_chars) { selected.push(item); chars += item.content.length; }
  }
  const diff = diffContext(previous, selected);
  const full_context_chars = selected.reduce((sum, item) => sum + item.content.length, 0);
  const delta_chars = diff.delta_chars;
  const version = context_version || `v${hash(selected.map(item => `${item.id}:${item.hash}`).join('|')).slice(0, 12)}`;
  return { context_version: version, fragments: selected, dropped: normalized.filter(item => !selected.some(kept => kept.id === item.id) && !item.must_keep), full_context_chars, delta_chars, delta_reuse_percent: full_context_chars ? Number(((Math.max(0, full_context_chars - delta_chars) / full_context_chars) * 100).toFixed(2)) : 0, estimated_tokens_avoided: Math.ceil(Math.max(0, full_context_chars - delta_chars) / 4), cache_hits: 0, cache_misses: selected.length, measurement_type: 'estimated', source: 'context.compiler', timestamp: new Date().toISOString() };
}

function deduplicateFragments(fragments) {
  const unique = new Map();
  for (const fragment of fragments) {
    const key = fragment.hash + '\u0000' + fragment.content;
    const current = unique.get(key);
    if (!current || fragment.priority > current.priority || (fragment.priority === current.priority && fragment.id < current.id)) unique.set(key, fragment);
  }
  return [...unique.values()];
}

export { LEVELS };
