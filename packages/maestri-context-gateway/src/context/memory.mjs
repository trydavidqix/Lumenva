import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const pathFor = root => join(root, 'state', 'memory', 'records.jsonl');

export async function remember(root, record = {}) {
  const row = { id: record.id || `memory-${Date.now()}`, layer: record.layer || 'L3', scope: record.scope || 'project', content: record.content || '', source: record.source || 'memory', provenance: record.provenance || null, timestamp: record.timestamp || new Date().toISOString() };
  await mkdir(join(root, 'state', 'memory'), { recursive: true, mode: 0o700 });
  await appendFile(pathFor(root), `${JSON.stringify(row)}\n`, { mode: 0o600 });
  return row;
}

export async function recall(root, { layer, scope } = {}) {
  try {
    return (await readFile(pathFor(root), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(item => (!layer || item.layer === layer) && (!scope || item.scope === scope));
  } catch { return []; }
}
