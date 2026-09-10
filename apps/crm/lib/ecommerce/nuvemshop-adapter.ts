import { signWebhook, verifyHmac } from "@/lib/nuvemshop/oauth";
import { NuvemshopApiClient } from "@/lib/nuvemshop/api-client";
import { NUVEMSHOP_SECURITY_HEADERS, safeNuvemshopError } from "./nuvemshop-hardening";
import { NuvemshopCircuitBreaker, type NuvemshopCircuitHealth } from "./nuvemshop-circuit";
import type {
  EcommerceCustomerDataRequest,
  EcommerceOrder,
  EcommerceOrderEvent,
  EcommerceProvider,
  EcommerceRedactRequest,
} from "./types";

type Payload = Record<string, unknown>;
const asPayload = (value: unknown): Payload =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Payload)
    : {};
const stringValue = (value: unknown): string | null =>
  value === undefined || value === null || value === "" ? null : String(value);

export interface NuvemshopAdapterOptions {
  storeId: string;
  accessToken: string;
  clientSecret: string;
  client?: NuvemshopApiClient;
}

export class NuvemshopAdapter implements EcommerceProvider {
  readonly name = "nuvemshop";
  readonly provider = "nuvemshop";
  private readonly clientSecret: string;
  private readonly client: NuvemshopApiClient;
  private readonly circuit: NuvemshopCircuitBreaker;

  constructor(options: NuvemshopAdapterOptions) {
    this.clientSecret = options.clientSecret;
    this.client = options.client ?? new NuvemshopApiClient(options);
    this.circuit = new NuvemshopCircuitBreaker();
  }

  health(): NuvemshopCircuitHealth {
    return this.circuit.health();
  }

  rollback(): void {
    this.circuit.rollback();
  }

  executeWithCircuit<T>(operation: () => Promise<T>): Promise<T> {
    return this.circuit.execute(operation);
  }

  securityHeaders(): typeof NUVEMSHOP_SECURITY_HEADERS {
    return NUVEMSHOP_SECURITY_HEADERS;
  }

  async executeSafely<T>(operation: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: ReturnType<typeof safeNuvemshopError> }> {
    try { return { ok: true, data: await this.executeWithCircuit(operation) }; }
    catch (error) { return { ok: false, error: safeNuvemshopError(error) }; }
  }

  verifyWebhookSignature(
    rawBodyOrInput: string | { rawBody: string; signature: string | null | undefined; secret?: string },
    signature?: string | null,
  ): boolean {
    const rawBody = typeof rawBodyOrInput === "string" ? rawBodyOrInput : rawBodyOrInput.rawBody;
    const header = typeof rawBodyOrInput === "string" ? signature : rawBodyOrInput.signature;
    return verifyHmac(rawBody, header, this.clientSecret);
  }

  parseOrderEvent(payloadOrInput: unknown, event = "order/updated"): EcommerceOrderEvent {
    if (typeof payloadOrInput === "object" && payloadOrInput !== null && "rawBody" in payloadOrInput) {
      const input = payloadOrInput as { eventType: string; rawBody: string };
      return this.parseOrderEvent(JSON.parse(input.rawBody) as Payload, input.eventType);
    }
    const payload = payloadOrInput;
    const body = asPayload(payload);
    const storeId = stringValue(body.store_id) ?? "unknown";
    const externalId = stringValue(body.id) ?? "unknown";
    return {
      event,
      externalId,
      storeId,
      payload: body,
      idempotencyKey: `${this.name}:${event}:${storeId}:${externalId}`,
    };
  }

  parseCustomerDataRequest(payloadOrInput: unknown): EcommerceCustomerDataRequest {
    const payload = typeof payloadOrInput === "object" && payloadOrInput !== null && "rawBody" in payloadOrInput
      ? JSON.parse((payloadOrInput as { rawBody: string }).rawBody)
      : payloadOrInput;
    const body = asPayload(payload);
    const storeId = stringValue(body.store_id) ?? "unknown";
    const customer = asPayload(body.customer);
    const customerId = stringValue(customer.id);
    const eventId = stringValue(body.event_id) ?? this.stableEventId("customer/data_request", storeId, customerId);
    return { storeId, customerId, eventId, payload: body, idempotencyKey: `${this.name}:customer/data_request:${eventId}` };
  }

  parseRedactRequest(payloadOrInput: unknown, scope: "customer" | "store" = "customer"): EcommerceRedactRequest {
    const payload = typeof payloadOrInput === "object" && payloadOrInput !== null && "rawBody" in payloadOrInput
      ? JSON.parse((payloadOrInput as { rawBody: string }).rawBody)
      : payloadOrInput;
    if (typeof payloadOrInput === "object" && payloadOrInput !== null && "rawBody" in payloadOrInput) {
      scope = (payloadOrInput as unknown as { scope: "customer" | "store" }).scope;
    }
    const body = asPayload(payload);
    const storeId = stringValue(body.store_id) ?? "unknown";
    const customer = asPayload(body.customer);
    const customerId = stringValue(customer.id);
    const eventName = scope === "store" ? "store/redact" : "customer/redact";
    const eventId = stringValue(body.event_id) ?? this.stableEventId(eventName, storeId, customerId);
    return { storeId, customerId, eventId, scope, payload: body, idempotencyKey: `${this.name}:${eventName}:${eventId}` };
  }

  async listOrdersSince(sinceOrInput: Date | string | { since?: string }): Promise<EcommerceOrder[]> {
    const since = typeof sinceOrInput === "object" && !(sinceOrInput instanceof Date)
      ? sinceOrInput.since ?? new Date(0).toISOString()
      : sinceOrInput;
    const value = since instanceof Date ? since.toISOString() : new Date(since).toISOString();
    const orders = await this.client.get<Array<Record<string, unknown>>>(`/orders?created_at_min=${encodeURIComponent(value)}`);
    return orders.map((order) => ({
      externalId: stringValue(order.id) ?? "unknown",
      currency: this.normalizeCurrency(order.currency ?? order.currency_code),
      totalCents: this.totalCents(order.total),
      createdAt: stringValue(order.created_at),
      raw: order,
    }));
  }

  normalizeCurrency(currency: unknown): string | null {
    const value = stringValue(currency)?.trim().toUpperCase();
    if (!value) return null;
    const aliases: Record<string, string> = { R$: "BRL", "$": "USD", "€": "EUR" };
    return aliases[value] ?? value;
  }

  private totalCents(value: unknown): number | null {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }

  private stableEventId(event: string, storeId: string, customerId: string | null): string {
    return signWebhook(`${event}:${storeId}:${customerId ?? "unknown"}`, this.clientSecret).slice(0, 32);
  }
}
