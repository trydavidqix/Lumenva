import { ExecutionPort } from './execution-port.js';

export class QuotaRouter {
  async selectProviderBasedOnQuota(providers: ExecutionPort[], requiredCapabilities: string[] = []): Promise<ExecutionPort> {
    for (const provider of providers) {
      const health = await provider.health();
      if (!health.ok || health.status === 'unavailable') continue;
      const capabilities = await provider.capabilities();
      if (requiredCapabilities.some((capability) => !capabilities.includes(capability))) continue;
      const quota = await provider.quota();
      if (quota.available === false || quota.remaining_budget === undefined || quota.remaining_budget <= 0) continue;
      return provider;
    }
    throw new Error('No healthy providers with verified quota.');
  }
}
