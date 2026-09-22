import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const buses = new Map();

export function createEventBus(root) {
  const listeners = new Set();
  const publish = async (type, payload = {}, meta = {}) => {
    const event = { event_id: `evt-${randomUUID()}`, type, timestamp: new Date().toISOString(), source: meta.source || 'mcg', trace_id: meta.trace_id || null, task_id: meta.task_id || null, payload };
    await mkdir(join(root, 'state', 'events'), { recursive: true, mode: 0o700 });
    await appendFile(join(root, 'state', 'events', 'events.jsonl'), `${JSON.stringify(event)}\n`, { mode: 0o600 });
    for (const listener of listeners) await listener(event);
    return event;
  };
  return { publish, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}

export function getEventBus(root) {
  if (!buses.has(root)) buses.set(root, createEventBus(root));
  return buses.get(root);
}
