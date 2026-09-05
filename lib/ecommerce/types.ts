/** Provider-neutral e-commerce contract.
 *
 * Parsers deliberately return a small, stable shape. Provider payloads remain
 * opaque at the boundary and are never persisted by this module.
 */
export interface EcommerceOrderEvent {
  event: string;
  externalId: string;
  storeId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export interface EcommerceCustomerDataRequest {
  storeId: string;
  customerId: string | null;
  eventId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export interface EcommerceRedactRequest {
  storeId: string;
  customerId: string | null;
  eventId: string;
  scope: "customer" | "store";
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export interface EcommerceOrder {
  externalId: string;
  currency: string | null;
  totalCents: number | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
}

export interface EcommerceProvider {
  readonly provider: string;
  readonly name: string;
  verifyWebhookSignature(rawBody: string, signature: string | null | undefined, secret?: string): boolean;
  verifyWebhookSignature(input: { rawBody: string; signature: string | null | undefined; secret?: string }): boolean;
  parseOrderEvent(payload: unknown, event?: string): EcommerceOrderEvent;
  parseOrderEvent(input: { eventType: string; rawBody: string }): EcommerceOrderEvent;
  parseCustomerDataRequest(payload: unknown): EcommerceCustomerDataRequest;
  parseCustomerDataRequest(input: { rawBody: string }): EcommerceCustomerDataRequest;
  parseRedactRequest(payload: unknown, scope?: "customer" | "store"): EcommerceRedactRequest;
  parseRedactRequest(input: { scope: "customer" | "store"; rawBody: string }): EcommerceRedactRequest;
  listOrdersSince(since: Date | string): Promise<EcommerceOrder[]>;
  listOrdersSince(input: { since?: string; accessToken?: string; storeId?: string; cursor?: string; pageSize?: number }): Promise<EcommerceOrder[]>;
  normalizeCurrency(currency: unknown): string | null;
}
