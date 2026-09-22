import type { ExecutionPort } from './execution-port';

export interface ProviderHealthSnapshot {
  provider: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  latency_ms: number;
  observed_at: string;
}

export async function probeProviders(ports: ExecutionPort[]): Promise<ProviderHealthSnapshot[]> {
  const output: ProviderHealthSnapshot[] = [];
  for (const port of ports) {
    const started = Date.now();
    try {
      const status = port.health ? await port.health() : (await port.checkQuota()).health ?? 'degraded';
      output.push({ provider: port.name, status, latency_ms: Date.now() - started, observed_at: new Date().toISOString() });
    } catch {
      output.push({ provider: port.name, status: 'unavailable', latency_ms: Date.now() - started, observed_at: new Date().toISOString() });
    }
  }
  return output;
}
