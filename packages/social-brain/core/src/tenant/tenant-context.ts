import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextData {
  organizationId: string;
  userId?: string;
}

const tenantStorage = new AsyncLocalStorage<TenantContextData>();

export class TenantContext {
  /**
   * Executes a callback within the provided tenant context.
   * This ensures `organizationId` is implicitly passed and isolated during the execution.
   */
  static run<R>(data: TenantContextData, callback: () => R): R {
    return tenantStorage.run(data, callback);
  }

  /**
   * Retrieves the current tenant context data.
   * Throws an error if called outside a tenant context.
   */
  static current(): TenantContextData {
    const data = tenantStorage.getStore();
    if (!data) {
      throw new Error('TenantContext: Executed outside of a tenant context. Wrap your execution with TenantContext.run().');
    }
    return data;
  }

  /**
   * Retrieves the current tenant context data, returning undefined if outside a context.
   */
  static currentOptional(): TenantContextData | undefined {
    return tenantStorage.getStore();
  }
}
