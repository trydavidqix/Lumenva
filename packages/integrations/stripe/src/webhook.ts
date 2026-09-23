import Stripe from "stripe";

export class StripeWebhookAdapter {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(config: { webhookSecret: string }) {
    if (!config.webhookSecret) {
      throw new Error("Missing webhookSecret");
    }
    this.webhookSecret = config.webhookSecret;
    // Stripe instance only needed for crypto validation here, no network
    this.stripe = new Stripe("sk_dummy", { apiVersion: "2023-10-16" });
  }

  verifySignature(payload: string, signature: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return true;
    } catch (err) {
      return false;
    }
  }
}
