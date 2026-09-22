import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const cachePath = root => join(root, 'state', 'telemetry', 'context-cache.json');

async function load(root) { try { return JSON.parse(await readFile(cachePath(root), 'utf8')); } catch { return {}; } }

export async function cacheContext(root, fragments = []) {
  const cache = await load(root);
  const hits = [];
  const misses = [];

  for (const fragment of fragments) {
    if (cache[fragment.hash]) hits.push(fragment);
    else misses.push(fragment);
  }

  for (const fragment of misses) {
    cache[fragment.hash] = {
      content_hash: fragment.hash,
      content_chars: fragment.content.length,
      first_seen: new Date().toISOString()
    };
  }

  await mkdir(join(root, 'state', 'telemetry'), { recursive: true, mode: 0o700 });
  await writeFile(cachePath(root), `${JSON.stringify(cache, null, 2)}\n`, { mode: 0o600 });

  const hitChars = hits.reduce((sum, fragment) => sum + fragment.content.length, 0);
  return {
    cache_hits: hits.length,
    cache_misses: misses.length,
    cache_hit_rate: fragments.length ? Number((hits.length / fragments.length * 100).toFixed(2)) : 0,
    context_reused: hits.length > 0,
    tokens_avoided_estimated: hits.length ? Math.ceil(hitChars / 4) : 0,
    measurement_type: 'estimated',
    source: 'state/telemetry/context-cache.json',
    timestamp: new Date().toISOString()
  };
}
