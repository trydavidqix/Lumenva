import { ExecutionPort } from './execution-port';

export class QuotaRouter {
  async selectProviderBasedOnQuota(providers: ExecutionPort[]): Promise<ExecutionPort> {
    for (const provider of providers) {
      const quota = await provider.checkQuota();
      if (quota.remaining_budget === undefined || quota.remaining_budget > 0) {
        return provider;
      }
    }
    throw new Error('No providers with available quota.');
  }
}
