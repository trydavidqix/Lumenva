import { describe, it, expect, vi } from "vitest";
import { StripeWebhookAdapter } from "./webhook";
import Stripe from "stripe";

vi.mock("stripe");

describe("StripeWebhookAdapter", () => {
  it("fails if instantiated without webhook secret", () => {
    expect(() => new StripeWebhookAdapter({ webhookSecret: "" })).toThrow();
  });

  it("verifySignature returns false on error, true on success", () => {
    const constructEventMock = vi.fn();
    (Stripe as any).mockImplementation(() => ({
      webhooks: { constructEvent: constructEventMock }
    }));

    const adapter = new StripeWebhookAdapter({ webhookSecret: "sec_123" });

    // Simulate invalid signature
    constructEventMock.mockImplementationOnce(() => {
      throw new Error("Invalid signature");
    });
    const invalid = adapter.verifySignature("payload", "bad_sig");
    expect(invalid).toBe(false);

    // Simulate valid signature
    constructEventMock.mockImplementationOnce(() => ({
      type: "customer.subscription.created",
      data: { object: { id: "sub_1" } }
    }));
    const valid = adapter.verifySignature("payload", "good_sig");
    expect(valid).toBe(true);
  });
});
