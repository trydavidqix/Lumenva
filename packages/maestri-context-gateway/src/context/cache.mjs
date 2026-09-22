import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const cachePath = root => join(root, 'state', 'telemetry', 'context-cache.json');

async function load(root) { try { return JSON.parse(await readFile(cachePath(root), 'utf8')); } catch { return {}; } }

export async function cacheContext(root, fragments = []) {
  const cache = await load(root); let cache_hits = 0; let cache_misses = 0;
  for (const fragment of fragments) {
    if (cache[fragment.hash]) cache_hits += 1; else { cache[fragment.hash] = { content_hash: fragment.hash, content_chars: fragment.content.length, first_seen: new Date().toISOString() }; cache_misses += 1; }
  }
  await mkdir(join(root, 'state', 'telemetry'), { recursive: true, mode: 0o700 });
  await writeFile(cachePath(root), `${JSON.stringify(cache, null, 2)}\n`, { mode: 0o600 });
  return { cache_hits, cache_misses, cache_hit_rate: fragments.length ? Number((cache_hits / fragments.length * 100).toFixed(2)) : 0, context_reused: cache_hits > 0, tokens_avoided_estimated: cache_hits ? Math.ceil(fragments.filter(fragment => cache[fragment.hash]).reduce((sum, fragment) => sum + fragment.content.length, 0) / 4) : 0, measurement_type: 'estimated', source: 'state/telemetry/context-cache.json', timestamp: new Date().toISOString() };
}
