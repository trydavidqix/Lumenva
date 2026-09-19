import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { fail, ok } from "@/lib/api/wrappers";
import { createAdminClient } from "@/lib/supabase/admin";
import { processStripeWebhook } from "@/lib/billing/stripe-webhook";
import { createStripeWebhookStore } from "@/lib/billing/stripe-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const rawBody = await req.text();
  try {
    const result = await processStripeWebhook({ rawBody, signature: req.headers.get("stripe-signature"), secret: process.env.STRIPE_WEBHOOK_SECRET ?? "", repository: createStripeWebhookStore(createAdminClient()) });
    return ok(result, { requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "stripe webhook rejected";
    console.error(`[stripe-webhook] rejected request ${requestId}: ${message}`);
    const status = /signature|event envelope|event data|event object|event id\/type|unsupported event/i.test(message) ? 400 : /organization|plan|entitlement/i.test(message) ? 422 : 500;
    const safeMessage = status === 400
      ? "Invalid Stripe webhook."
      : status === 422
        ? "Stripe event is not applicable to an active organization entitlement."
        : "Stripe webhook unavailable.";
    return fail(status === 400 ? "validation_failed" : status === 422 ? "unprocessable_entity" : "internal_error", safeMessage, status, { requestId });
  }
}
