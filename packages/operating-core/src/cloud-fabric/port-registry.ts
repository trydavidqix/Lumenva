import type { ExecutionPort } from './execution-port';

export class ExecutionPortRegistry {
  private readonly ports = new Map<string, ExecutionPort>();

  register(port: ExecutionPort): void {
    this.ports.set(port.name, port);
  }

  unregister(name: string): void {
    this.ports.delete(name);
  }

  resolve(provider: string): ExecutionPort | undefined {
    return this.ports.get(provider);
  }

  list(): ExecutionPort[] {
    return [...this.ports.values()];
  }
}
