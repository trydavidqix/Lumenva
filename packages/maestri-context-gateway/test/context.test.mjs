import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileContext, diffContext } from '../src/context/compiler.mjs';
import { cacheContext } from '../src/context/cache.mjs';
import { remember, recall } from '../src/context/memory.mjs';

const root = await mkdtemp(join(tmpdir(), 'mcg-context-'));
try {
  const critical = { id: 'owner', category: 'must_keep', content: 'OWNER_APPROVAL_REQUIRED', priority: 100 };
  const compiled = compileContext({ fragments: [critical, { id: 'old', category: 'historical', content: 'x'.repeat(100) }], budget_chars: 10 });
  assert.equal(compiled.fragments.some(item => item.id === 'owner'), true);
  assert.equal(compiled.dropped.some(item => item.id === 'owner'), false);
  const changed = diffContext([{ id: 'a', content: 'one' }], [{ id: 'a', content: 'two' }, { id: 'b', content: 'new' }]);
  assert.equal(changed.changed.length, 1); assert.equal(changed.added.length, 1);
  const first = await cacheContext(root, compiled.fragments); const second = await cacheContext(root, compiled.fragments);
  assert.equal(first.cache_hits, 0); assert.equal(first.tokens_avoided_estimated, 0);
  assert.equal(second.cache_hits, compiled.fragments.length); assert.equal(second.cache_hit_rate, 100);
  assert.equal(second.tokens_avoided_estimated, Math.ceil(compiled.fragments.reduce((sum, item) => sum + item.content.length, 0) / 4));
  const mixed = await cacheContext(root, [compiled.fragments[0], { id: 'fresh', hash: 'fresh-hash', content: '12345678' }]);
  assert.equal(mixed.cache_hits, 1); assert.equal(mixed.cache_misses, 1);
  assert.equal(mixed.tokens_avoided_estimated, Math.ceil(compiled.fragments[0].content.length / 4));
  await remember(root, { id: 'decision-1', layer: 'L4', content: 'keep evidence', source: 'test' });
  assert.equal((await recall(root, { layer: 'L4' })).length, 1);
} finally { await rm(root, { recursive: true, force: true }); }
console.log('context tests: 1 passed');
