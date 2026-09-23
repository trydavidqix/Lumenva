import { NextRequest, NextResponse } from "next/server";
import { normalizeMetaPayload, verifyChallenge, verifySignature } from "@lumenva/integration-meta/webhook";

const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";

// Idempotency cache — in production, replace with Redis or DB-backed set
const processedEvents = new Set<string>();

// GET: Meta hub verification challenge
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const result = verifyChallenge(mode, token, challenge, META_WEBHOOK_VERIFY_TOKEN);
  if (result) {
    return new NextResponse(result, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST: Meta event delivery
export async function POST(req: NextRequest) {
  // Always respond 200 to prevent Meta from suspending the webhook
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    if (!verifySignature(rawBody, signature, META_APP_SECRET)) {
      console.error("[meta-webhook] Invalid signature — rejected");
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      console.error("[meta-webhook] Invalid JSON body");
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const events = normalizeMetaPayload(payload);

    for (const event of events) {
      // Idempotency: skip already-processed events
      if (processedEvents.has(event.externalEventId)) {
        console.info(`[meta-webhook] Duplicate event skipped: ${event.externalEventId}`);
        continue;
      }
      processedEvents.add(event.externalEventId);
      // Trim cache to prevent unbounded growth
      if (processedEvents.size > 10_000) {
        const first = processedEvents.values().next().value;
        if (first) processedEvents.delete(first);
      }

      // Audit log (no tokens, no PII beyond event ID)
      console.info(`[meta-webhook] social.webhook.received`, {
        platform: event.platform,
        eventType: event.eventType,
        externalEventId: event.externalEventId,
        accountExternalId: event.accountExternalId,
      });

      // TODO (Phase 16): Dispatch to Social Event pipeline
      // await socialEventQueue.dispatch(event);
    }
  } catch (err) {
    console.error("[meta-webhook] Unexpected error", err);
  }

  // Always return 200 to Meta
  return NextResponse.json({ ok: true }, { status: 200 });
}
