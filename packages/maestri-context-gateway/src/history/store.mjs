import { appendFile, mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

export const HISTORY_TYPES = Object.freeze([
  'telemetry',
  'traces',
  'evals',
  'replay',
  'alerts',
  'cache_metrics',
  'usage',
  'tasks',
  'runtime_health'
]);

const TYPE_SET = new Set(HISTORY_TYPES);
const MEASUREMENT_TYPES = new Set(['exact', 'estimated', 'unavailable']);
const PERIODS = Object.freeze({
  TODAY: 86_400_000,
  '7D': 7 * 86_400_000,
  '30D': 30 * 86_400_000,
  ALL_TIME: null
});
const SECRET_KEY = /pass(word)?|secret|private[_-]?key|api[_-]?key|authorization|cookie|credential/i;
const TOKEN_MEASUREMENT_KEY = /^(input_tokens|cached_input_tokens|output_tokens|reasoning_tokens|total_tokens|estimated_tokens|tokens)$/i;

function sanitize(value, key = '') {
  if (TOKEN_MEASUREMENT_KEY.test(key) && Number.isFinite(value)) return value;
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(item => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, sanitize(item, name)]));
  }
  return value;
}

function normalizePeriod(period) {
  const value = String(period || 'ALL_TIME').trim().toUpperCase().replace(/\s+/g, '_');
  if (value === 'TODAY') return 'TODAY';
  if (value === '7D' || value === '7_DAYS' || value === '7_D') return '7D';
  if (value === '30D' || value === '30_DAYS' || value === '30_D') return '30D';
  if (value === 'ALL' || value === 'ALLTIME' || value === 'ALL_TIME') return 'ALL_TIME';
  throw new Error(`unsupported history period: ${period}`);
}

function timestampOf(record) {
  const value = record?.timestamp || record?.created_at || record?.updated_at;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function dateKey(timestamp) {
  return String(timestamp).slice(0, 10);
}

async function readJsonl(path) {
  try {
    return (await readFile(path, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .flatMap(line => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
  } catch {
    return [];
  }
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, path);
}

export class FileHistoryStore {
  constructor(root, { retention_days = 365 } = {}) {
    if (!root) throw new Error('history root is required');
    this.root = root;
    this.retention_days = retention_days;
    this.base = join(root, 'state', 'history');
  }

  rawPath(type) {
    if (!TYPE_SET.has(type)) throw new Error(`unsupported history type: ${type}`);
    return join(this.base, 'raw', `${type}.jsonl`);
  }

  async append(type, record = {}) {
    if (!TYPE_SET.has(type)) throw new Error(`unsupported history type: ${type}`);
    const timestamp = timestampOf(record);
    const measurement_type = MEASUREMENT_TYPES.has(record.measurement_type)
      ? record.measurement_type
      : 'unavailable';
    const source = record.source || `history.${type}`;
    const data = sanitize(record);
    const encoded = JSON.stringify(data);
    const row = {
      history_id: `hist-${randomUUID()}`,
      history_type: type,
      timestamp,
      source,
      provenance: record.provenance ?? { source },
      measurement_type,
      content_hash: createHash('sha256').update(encoded).digest('hex'),
      data
    };
    const path = this.rawPath(type);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await appendFile(path, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    return row;
  }

  async query(type, { period = 'ALL_TIME', from, to, limit = 500, predicate } = {}) {
    const normalized = normalizePeriod(period);
    const rows = await readJsonl(this.rawPath(type));
    const now = Date.now();
    const periodMs = PERIODS[normalized];
    const fromMs = from ? Date.parse(from) : periodMs == null ? null : now - periodMs;
    const toMs = to ? Date.parse(to) : null;
    const filtered = rows.filter(row => {
      const time = Date.parse(row.timestamp);
      if (!Number.isFinite(time)) return false;
      if (Number.isFinite(fromMs) && time < fromMs) return false;
      if (Number.isFinite(toMs) && time > toMs) return false;
      if (typeof predicate === 'function' && !predicate(row)) return false;
      return true;
    });
    return filtered.slice(-Math.max(1, Math.min(Number(limit) || 500, 5000)));
  }

  async rollupDaily(type, day = new Date().toISOString().slice(0, 10)) {
    const rows = (await readJsonl(this.rawPath(type))).filter(row => dateKey(row.timestamp) === day);
    const counts = { exact: 0, estimated: 0, unavailable: 0 };
    let total_tokens = 0;
    let observed_token_rows = 0;
    for (const row of rows) {
      counts[row.measurement_type] = (counts[row.measurement_type] || 0) + 1;
      const tokens = row.data?.total_tokens ?? row.data?.tokens;
      if (Number.isFinite(tokens)) {
        total_tokens += tokens;
        observed_token_rows += 1;
      }
    }
    const rollup = {
      type,
      day,
      records: rows.length,
      measurement_counts: counts,
      total_tokens: observed_token_rows ? total_tokens : null,
      source: `state/history/raw/${type}.jsonl`,
      measurement_type: rows.length && rows.every(row => row.measurement_type === 'exact') ? 'exact' : rows.length ? 'estimated' : 'unavailable',
      timestamp: new Date().toISOString()
    };
    await atomicJson(join(this.base, 'rollups', type, `${day}.json`), rollup);
    return rollup;
  }

  async periods(type) {
    const result = {};
    for (const period of ['TODAY', '7D', '30D', 'ALL_TIME']) {
      result[period] = await this.query(type, { period });
    }
    return result;
  }

  async applyRetention({ now = Date.now() } = {}) {
    if (!Number.isFinite(this.retention_days) || this.retention_days <= 0) return { archived: 0 };
    const cutoff = now - this.retention_days * 86_400_000;
    let archived = 0;
    for (const type of HISTORY_TYPES) {
      const path = this.rawPath(type);
      const rows = await readJsonl(path);
      if (!rows.length) continue;
      const keep = [];
      const expired = [];
      for (const row of rows) {
        const time = Date.parse(row.timestamp);
        (Number.isFinite(time) && time < cutoff ? expired : keep).push(row);
      }
      if (!expired.length) continue;
      const archivePath = join(this.base, 'archive', type, `${new Date(now).toISOString().slice(0, 10)}.jsonl`);
      await mkdir(dirname(archivePath), { recursive: true, mode: 0o700 });
      await appendFile(archivePath, expired.map(row => JSON.stringify(row)).join('\n') + '\n', { mode: 0o600 });
      await writeFile(path, keep.length ? keep.map(row => JSON.stringify(row)).join('\n') + '\n' : '', { mode: 0o600 });
      archived += expired.length;
    }
    return { archived, cutoff: new Date(cutoff).toISOString() };
  }

  async listAvailableTypes() {
    const dir = join(this.base, 'raw');
    try {
      const names = await readdir(dir);
      return names.filter(name => name.endsWith('.jsonl')).map(name => name.slice(0, -6)).filter(name => TYPE_SET.has(name));
    } catch {
      return [];
    }
  }
}

const stores = new Map();

export function getHistoryStore(root, options) {
  if (!stores.has(root)) stores.set(root, new FileHistoryStore(root, options));
  return stores.get(root);
}

export async function recordHistory(root, type, record) {
  return getHistoryStore(root).append(type, record);
}
