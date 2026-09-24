import type { ShadowMode } from './types';

export class ShadowFlagProvider {
  // Local state to simulate feature flags for testing
  private flags = new Map<string, ShadowMode>();

  public getFlag(domain: string, organizationId: string): ShadowMode {
    const key = `${domain}:${organizationId}`;
    return this.flags.get(key) || 'off';
  }

  public setFlag(domain: string, organizationId: string, mode: ShadowMode): void {
    const key = `${domain}:${organizationId}`;
    this.flags.set(key, mode);
  }

  public forceRollback(domain: string, organizationId: string): void {
    this.setFlag(domain, organizationId, 'off');
  }
}
