import { NextRequest, NextResponse } from "next/server";
import { verifySignature, verifyChallenge } from "@lumenva/integration-meta";
import { normalizeMetaPayload } from "@lumenva/integration-meta";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabase/service-role";

// Note: we can't use an index.ts export because the allowlist restricts us,
// so we import directly. (6 levels up to root)
import { createEventIngester } from "../../../../../../packages/core/social-brain/core/src/social/ingest/event-ingester";

const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
const META_PROVIDER_ENABLED = process.env.SOCIAL_META_ENABLED !== "false";

// Instantiate the ingester at the module level so the in-memory cache persists across requests
const ingester = createEventIngester({ metaEnabled: META_PROVIDER_ENABLED });

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

    if (events.length === 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Initialize the DB
    let supabase;
    try {
      supabase = createSupabaseServiceRoleClient();
    } catch (err) {
      console.error("[meta-webhook] Could not init supabase service role client", err);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    for (const event of events) {
      if (!event.accountExternalId) {
        console.warn(`[meta-webhook] Missing accountExternalId on event: ${event.externalEventId}`);
        continue;
      }

      // 1. Resolve Tenant & Account matching
      // This mapping fails closed if absent or disabled.
      const { data: accounts, error: accountErr } = await supabase
        .from('social_accounts')
        .select('id, workspace_id, status')
        .eq('external_account_id', event.accountExternalId)
        .eq('platform', event.platform)
        .eq('status', 'active');

      if (accountErr || !accounts || accounts.length === 0) {
        console.warn(`[meta-webhook] Event rejected: Account absent or inactive`, {
          externalEventId: event.externalEventId,
          accountExternalId: event.accountExternalId,
        });
        continue;
      }

      if (accounts.length > 1) {
         console.warn(`[meta-webhook] Event rejected: Ambiguous account mapping`, {
          externalEventId: event.externalEventId,
          accountExternalId: event.accountExternalId,
        });
        continue;
      }

      const matchedAccount = accounts[0];

      // 2. Ingest
      const result = ingester.ingest(
        {
          platform: event.platform,
          eventType: event.eventType,
          externalEventId: event.externalEventId,
          accountExternalId: event.accountExternalId,
          payload: event.payload
        },
        matchedAccount.workspace_id,
        matchedAccount.id
      );

      if (!result.ok) {
        console.warn(`[meta-webhook] Event rejected: ${result.error}`, {
          externalEventId: event.externalEventId,
          accountExternalId: event.accountExternalId,
        });
        continue;
      }

      console.info(`[meta-webhook] social.webhook.received`, {
        platform: event.platform,
        eventType: event.eventType,
        externalEventId: event.externalEventId,
        accountExternalId: event.accountExternalId,
        workspaceId: matchedAccount.workspace_id,
        receipt: result.receipt,
      });
    }
  } catch (err) {
    console.error("[meta-webhook] Unexpected error", err);
  }

  // Always return 200 to Meta
  return NextResponse.json({ ok: true }, { status: 200 });
}
