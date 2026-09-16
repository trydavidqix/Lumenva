#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dispatch, ensureLayout, ingest, loadState, listTasks, compactResult, removeTask, sliceEvidence, waitForTerminal, ROOT } from '../src/core.mjs';

const args = process.argv.slice(2);
const command = args.shift();
const value = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const json = value('--json') !== undefined || args.includes('--json');
const output = value('--output') || 'json';
const print = data => process.stdout.write(typeof data === 'string' ? `${data}\n` : `${JSON.stringify(data, null, 2)}\n`);

try {
  await ensureLayout();
  if (command === 'doctor') {
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    const maestri = spawnSync(process.env.MAESTRI_CLI || 'maestri', ['debug'], { encoding: 'utf8', timeout: 5000 });
    print({ root: ROOT, node: process.versions.node, node_ok: nodeMajor >= 22, storage: 'ok', maestri: maestri.status === 0 ? 'available' : 'unavailable', maestri_connection: maestri.stdout?.includes('Connection: OK') ? 'ok' : 'unknown', event_feed: 'not_exposed_by_installed_cli', auth: 'not inspected' });
  } else if (command === 'dispatch') {
    const file = value('--file');
    const input = file ? JSON.parse(await readFile(file, 'utf8')) : JSON.parse(await new Promise((resolve, reject) => { let s = ''; process.stdin.on('data', d => s += d); process.stdin.on('end', () => resolve(s)); process.stdin.on('error', reject); }));
    const state = await dispatch(input); print({ task_id: state.task_id, state: state.internal_state });
  } else if (command === 'ingest') {
    const file = value('--file');
    const event = JSON.parse(await readFile(file, 'utf8'));
    print(await ingest(event));
  } else if (command === 'status') {
    const id = args.find(a => !a.startsWith('-'));
    print(id ? compactResult(await loadState(id)) : (json ? await listTasks() : (await listTasks()).map(s => `${s.project} ${s.task_id} ${s.internal_state}`).join('\n')));
  } else if (command === 'result') {
    print(compactResult(await loadState(args[0])));
  } else if (command === 'wait') {
    print(await waitForTerminal(args[0]));
  } else if (command === 'evidence') {
    print(await sliceEvidence(args[0], value('--type'), Number(value('--lines') || 80)));
  } else if (command === 'cancel') {
    const state = await loadState(args[0]); state.internal_state = 'CANCELLED'; state.updated_at = new Date().toISOString(); await (await import('../src/core.mjs')).saveState(state); print({ task_id: state.task_id, state: state.internal_state });
  } else if (command === 'daemon') {
    const { watch } = await import('node:fs');
    const { readdir, readFile, unlink, open } = await import('node:fs/promises');
    const inbox = `${ROOT}/events/inbox`;
    const lockPath = `${ROOT}/state/daemon.pid`;
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); await lock.writeFile(`${process.pid}\n`); } catch { throw new Error('daemon already running or stale lock exists'); }
    const consume = async () => {
      for (const name of await readdir(inbox)) {
        if (!name.endsWith('.json')) continue;
        const path = `${inbox}/${name}`;
        try { await ingest(JSON.parse(await readFile(path, 'utf8'))); await unlink(path); } catch { /* retain malformed events for diagnosis */ }
      }
    };
    await consume();
    const watcher = watch(inbox, () => { void consume(); });
    const shutdown = async () => { watcher.close(); await lock.close(); await unlink(lockPath).catch(() => {}); process.exit(0); };
    process.on('SIGTERM', () => { void shutdown(); });
    process.on('SIGINT', () => { void shutdown(); });
    await new Promise(() => {});
  } else { print('mcg commands: doctor daemon status dispatch wait result evidence cancel ingest'); process.exitCode = 2; }
} catch (error) { process.stderr.write(`mcg: ${error.message}\n`); process.exitCode = 1; }
