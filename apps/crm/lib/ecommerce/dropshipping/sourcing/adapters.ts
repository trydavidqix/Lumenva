export interface SourcingAdapter {
  providerName: string;
  searchProducts(_query: string): Promise<unknown>;
  getProductQuote(_productId: string): Promise<unknown>;
}

export class AutoDSAdapter implements SourcingAdapter {
  providerName = 'AutoDS';

  async searchProducts(_query: string): Promise<unknown> {
    // EXTERNAL_VALIDATION_PENDING
    throw new Error('EXTERNAL_VALIDATION_PENDING');
  }

  async getProductQuote(_productId: string): Promise<unknown> {
    // EXTERNAL_VALIDATION_PENDING
    throw new Error('EXTERNAL_VALIDATION_PENDING');
  }
}

export class DSersAdapter implements SourcingAdapter {
  providerName = 'DSers';

  async searchProducts(_query: string): Promise<unknown> {
    // EXTERNAL_VALIDATION_PENDING
    throw new Error('EXTERNAL_VALIDATION_PENDING');
  }

  async getProductQuote(_productId: string): Promise<unknown> {
    // EXTERNAL_VALIDATION_PENDING
    throw new Error('EXTERNAL_VALIDATION_PENDING');
  }
}
