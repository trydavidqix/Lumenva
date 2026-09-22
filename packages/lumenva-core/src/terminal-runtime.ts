import { randomUUID } from 'node:crypto';
import { spawn, type IPty, type IPtyForkOptions, type IPtyForkOptions as SpawnOptions } from 'node-pty';
import type { EventBus } from './event-bus.js';

export type TerminalStatus = 'RUNNING' | 'EXITED';

export interface TerminalLaunchRequest {
  executable: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  traceId?: string;
  source?: string;
}

export interface TerminalSnapshot {
  id: string;
  executable: string;
  args: string[];
  cwd: string;
  cols: number;
  rows: number;
  status: TerminalStatus;
  pid: number;
  exitCode: number | null;
  signal: number | null;
  createdAt: string;
  exitedAt: string | null;
}

export interface TerminalOutput {
  terminalId: string;
  data: string;
}

export interface TerminalAdapter {
  spawn(executable: string, args: string[], options: SpawnOptions): IPty;
}

const nodePtyAdapter: TerminalAdapter = { spawn };

export class TerminalRuntime {
  #sessions = new Map<string, { pty: IPty; snapshot: TerminalSnapshot }>();

  constructor(
    private readonly events: EventBus,
    private readonly adapter: TerminalAdapter = nodePtyAdapter,
  ) {}

  list(): TerminalSnapshot[] {
    return [...this.#sessions.values()].map(({ snapshot }) => ({ ...snapshot }));
  }

  get(id: string): TerminalSnapshot | null {
    const session = this.#sessions.get(id);
    return session ? { ...session.snapshot } : null;
  }

  async create(request: TerminalLaunchRequest): Promise<TerminalSnapshot> {
    if (!request.executable.trim()) throw new Error('terminal_executable_required');
    if (!request.cwd.trim()) throw new Error('terminal_cwd_required');

    const id = randomUUID();
    const cols = request.cols ?? 120;
    const rows = request.rows ?? 30;
    const args = request.args ?? [];
    const options: IPtyForkOptions = {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: request.cwd,
      env: { ...process.env, ...request.env } as Record<string, string>,
      useConpty: process.platform === 'win32',
    };

    const pty = this.adapter.spawn(request.executable, args, options);
    const snapshot: TerminalSnapshot = {
      id,
      executable: request.executable,
      args: [...args],
      cwd: request.cwd,
      cols,
      rows,
      status: 'RUNNING',
      pid: pty.pid,
      exitCode: null,
      signal: null,
      createdAt: new Date().toISOString(),
      exitedAt: null,
    };
    this.#sessions.set(id, { pty, snapshot });

    pty.onData((data) => {
      void this.events.emit<TerminalOutput>(
        'terminal.output',
        { terminalId: id, data },
        { source: request.source ?? 'terminal-runtime', traceId: request.traceId },
      );
    });

    pty.onExit(({ exitCode, signal }) => {
      snapshot.status = 'EXITED';
      snapshot.exitCode = exitCode;
      snapshot.signal = signal;
      snapshot.exitedAt = new Date().toISOString();
      void this.events.emit(
        'terminal.exited',
        { terminalId: id, exitCode, signal },
        { source: request.source ?? 'terminal-runtime', traceId: request.traceId },
      );
    });

    await this.events.emit(
      'terminal.created',
      { terminalId: id, executable: request.executable, pid: pty.pid, cwd: request.cwd },
      { source: request.source ?? 'terminal-runtime', traceId: request.traceId },
    );
    return { ...snapshot };
  }

  write(id: string, data: string): void {
    const session = this.#requireRunning(id);
    session.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    if (cols < 1 || rows < 1) throw new Error('terminal_invalid_size');
    const session = this.#requireRunning(id);
    session.pty.resize(cols, rows);
    session.snapshot.cols = cols;
    session.snapshot.rows = rows;
  }

  kill(id: string, signal?: string): void {
    const session = this.#sessions.get(id);
    if (!session) throw new Error('terminal_not_found');
    if (session.snapshot.status === 'EXITED') return;
    session.pty.kill(signal);
  }

  #requireRunning(id: string) {
    const session = this.#sessions.get(id);
    if (!session) throw new Error('terminal_not_found');
    if (session.snapshot.status !== 'RUNNING') throw new Error('terminal_not_running');
    return session;
  }
}
