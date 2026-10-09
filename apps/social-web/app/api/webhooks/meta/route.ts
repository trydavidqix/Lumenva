import { NextRequest, NextResponse } from "next/server";
import { verifySignature, verifyChallenge } from "@lumenva/integration-meta";
import { normalizeMetaPayload } from "@lumenva/integration-meta";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabase/service-role";

// BLOCKED_SCOPE: We cannot import createEventIngester because cross-package relative
// imports are forbidden by AGENTS.md, and we cannot modify the `packages/core/.../index.ts`
// export manifest as it falls outside the Task 07 allowlist. We also cannot securely instantiate
// the CloudTasks client locally without duplicating config.

const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";

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
      console.error("[meta-webhook] Could not init supabase service role client");
      // Return 500 so the provider can retry this transient failure
      return new NextResponse("Internal Server Error", { status: 500 });
    }

    for (const event of events) {
      if (!event.accountExternalId) {
        console.warn(`[meta-webhook] Missing account identifier on event`);
        continue;
      }

      // 1. Resolve Tenant & Account matching
      // This mapping fails closed if absent or disabled (200 OK so provider drops it).
      const { data: accounts, error: accountErr } = await supabase
        .from('social_accounts')
        .select('id, workspace_id, status')
        .eq('external_account_id', event.accountExternalId)
        .eq('platform', event.platform)
        .eq('status', 'active');

      if (accountErr) {
        console.error(`[meta-webhook] Database error querying accounts`);
        // Return 500 so the provider can retry
        return new NextResponse("Internal Server Error", { status: 500 });
      }

      if (!accounts || accounts.length === 0) {
        console.warn(`[meta-webhook] Event rejected: Account absent or inactive`);
        continue;
      }

      if (accounts.length > 1) {
         console.warn(`[meta-webhook] Event rejected: Ambiguous account mapping`);
        continue;
      }

      // BLOCKED_SCOPE:
      // Durable deduplication, enqueue, and receipt cannot be reliably implemented
      // because we cannot access the ingester (cross-package import restriction)
      // and we cannot safely instantiate CloudTasksClient globally in this route
      // without modifying shared infrastructure files outside the allowlist.
      //
      // DEPENDENCY NEEDED:
      // 1. `packages/core/social-brain/core/src/index.ts` must export `createEventIngester`.
      // 2. `apps/social-web` requires a dependency injected or exported `CloudTasksClient` instance.
      //
      // TODO: Call ingester once it's exported via `@lumenva/social-brain`.

      console.info(`[meta-webhook] social.webhook.received`, {
        platform: event.platform,
        eventType: event.eventType,
        // Removed tenant, account, and event IDs to prevent identifier leakage
      });
    }
  } catch (err) {
    console.error("[meta-webhook] Unexpected error");
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  // Always return 200 to Meta on terminal completion or valid rejection
  return NextResponse.json({ ok: true }, { status: 200 });
}
