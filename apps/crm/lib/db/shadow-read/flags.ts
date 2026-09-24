import type { ShadowMode } from './types';

export class ShadowFlagProvider {
  // Local state to simulate feature flags for testing
  private flags = new Map<string, unknown>();

  private isShadowMode(value: unknown): value is ShadowMode {
    return value === 'off' || value === 'observe' || value === 'sampled' || value === 'enforced';
  }

  public getFlag(domain: string, organizationId: string): ShadowMode {
    const key = `${domain}:${organizationId}`;
    const mode = this.flags.get(key);
    return this.isShadowMode(mode) ? mode : 'off';
  }

  public setFlag(domain: string, organizationId: string, mode: unknown): void {
    const key = `${domain}:${organizationId}`;
    this.flags.set(key, this.isShadowMode(mode) ? mode : 'off');
  }

  public forceRollback(domain: string, organizationId: string): void {
    this.setFlag(domain, organizationId, 'off');
  }
}
