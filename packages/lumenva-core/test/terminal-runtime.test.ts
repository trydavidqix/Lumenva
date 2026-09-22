import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, TerminalRuntime, type TerminalAdapter } from '../src/index.ts';

class FakePty {
  pid = 4321;
  writes: string[] = [];
  sizes: Array<[number, number]> = [];
  killed = false;
  #data = new Set<(data: string) => void>();
  #exit = new Set<(event: { exitCode: number; signal: number }) => void>();
  onData(handler: (data: string) => void) { this.#data.add(handler); return { dispose: () => this.#data.delete(handler) }; }
  onExit(handler: (event: { exitCode: number; signal: number }) => void) { this.#exit.add(handler); return { dispose: () => this.#exit.delete(handler) }; }
  write(data: string) { this.writes.push(data); }
  resize(cols: number, rows: number) { this.sizes.push([cols, rows]); }
  kill() { this.killed = true; }
  emitData(data: string) { for (const handler of this.#data) handler(data); }
  emitExit(exitCode = 0, signal = 0) { for (const handler of this.#exit) handler({ exitCode, signal }); }
}

test('terminal runtime owns PTY lifecycle and emits real runtime events', async () => {
  const bus = new EventBus();
  const pty = new FakePty();
  const adapter: TerminalAdapter = { spawn: () => pty };
  const runtime = new TerminalRuntime(bus, adapter);
  const events: Array<{ type: string; payload: unknown }> = [];
  bus.on('*', (event) => events.push({ type: event.type, payload: event.payload }));

  const session = await runtime.create({ executable: 'pwsh', args: ['-NoLogo'], cwd: 'C:\\repo', cols: 100, rows: 25, traceId: 'trace-1' });
  assert.equal(session.status, 'RUNNING');
  assert.equal(session.pid, 4321);
  assert.equal(runtime.list().length, 1);

  runtime.write(session.id, 'echo ok\r');
  runtime.resize(session.id, 140, 40);
  pty.emitData('ok\r\n');
  pty.emitExit(0, 0);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(pty.writes, ['echo ok\r']);
  assert.deepEqual(pty.sizes, [[140, 40]]);
  assert.equal(runtime.get(session.id)?.status, 'EXITED');
  assert.equal(runtime.get(session.id)?.exitCode, 0);
  assert.deepEqual(events.map((event) => event.type), ['terminal.created', 'terminal.output', 'terminal.exited']);
});

test('terminal runtime rejects arbitrary writes to missing or exited sessions', async () => {
  const bus = new EventBus();
  const pty = new FakePty();
  const runtime = new TerminalRuntime(bus, { spawn: () => pty });
  assert.throws(() => runtime.write('missing', 'x'), /terminal_not_found/);
  const session = await runtime.create({ executable: 'codex', cwd: 'C:\\repo' });
  pty.emitExit(1, 0);
  assert.throws(() => runtime.write(session.id, 'x'), /terminal_not_running/);
});
