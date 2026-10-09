export type DropshippingState = 'not_started' | 'submitted' | 'confirmed' | 'failed' | 'unknown';
export type DropshippingMode = 'read_only' | 'simulated' | 'approved_write';

export interface MarketConfiguration {
  // "sem imposto, margem, frete, custo ou preço default" -> all required fields, no optional/default values.
  currency: string;
  tax_cents: number;
  margin_cents: number;
  shipping_cents: number;
  cost_cents: number;
  price_cents: number;
}

export interface DropshippingOrder {
  tenant_id: string;
  idempotency_key: string;
  payload_hash: string;
  executor_id: string | null;
  state: DropshippingState;
  mode: DropshippingMode;
  market: MarketConfiguration;
  receipts: string[];
}
