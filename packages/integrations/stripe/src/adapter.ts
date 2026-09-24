import Stripe from "stripe";

export type ExternalOperationContext = {
  organizationId: string;
  requestId: string;
  idempotencyKey?: string;
  dryRun?: boolean;
};

type RuntimePrice = { lookupKey: string; unitAmountCents: number; currency: string; interval: string };

type CreateInput = {
  organizationId: string;
  priceLookupKey: string;
  successUrl: string;
  cancelUrl: string;
  trialDays: number;
  trialRequiresPaymentMethod: boolean;
  metadata: { organization_id: string; plan_slug: string }
};

export class StripeAdapter {
  private stripe: Stripe;

  constructor(config: { apiKey: string }) {
    if (!config.apiKey) {
      throw new Error("Missing apiKey");
    }
    this.stripe = new Stripe(config.apiKey, {
      apiVersion: "2023-10-16",
      maxNetworkRetries: 2, // Built-in stripe retries, handles transient failures
      timeout: 10000 // Treat as transient timeout handled by SDK
    });
  }

  async createCheckoutSession(
    ctx: ExternalOperationContext,
    input: CreateInput
  ): Promise<{ sessionId: string; url: string; price: RuntimePrice }> {
    if (ctx.dryRun) {
      return {
        sessionId: `fake_cs_${Date.now()}`,
        url: input.successUrl,
        price: {
          lookupKey: input.priceLookupKey,
          unitAmountCents: 1000,
          currency: "usd",
          interval: "month"
        }
      };
    }

    try {
      const prices = await this.stripe.prices.list({ lookup_keys: [input.priceLookupKey] });
      const price = prices.data[0];
      if (!price) {
        throw new Error(`Price not found for lookupKey: ${input.priceLookupKey}`);
      }

      const session = await this.stripe.checkout.sessions.create({
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        client_reference_id: input.organizationId,
        metadata: input.metadata,
        subscription_data: input.trialDays > 0 ? {
          trial_period_days: input.trialDays
        } : undefined
      }, { idempotencyKey: ctx.idempotencyKey });

      return {
        sessionId: session.id,
        url: session.url!,
        price: {
          lookupKey: input.priceLookupKey,
          unitAmountCents: price.unit_amount ?? 0,
          currency: price.currency,
          interval: price.recurring?.interval ?? "month"
        }
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new Error(`Stripe API Error: ${err.message}`);
      }
      throw err;
    }
  }

  async cancelSubscription(
    ctx: ExternalOperationContext,
    input: { organizationId: string; subscriptionId: string; cancelAtPeriodEnd: true; applyCancellationFee: false }
  ): Promise<{ subscriptionId: string }> {
    if (ctx.dryRun) {
      return { subscriptionId: input.subscriptionId };
    }

    try {
      await this.stripe.subscriptions.update(input.subscriptionId, {
        cancel_at_period_end: input.cancelAtPeriodEnd
      }, { idempotencyKey: ctx.idempotencyKey });

      return { subscriptionId: input.subscriptionId };
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new Error(`Stripe API Error: ${err.message}`);
      }
      throw err;
    }
  }
}
