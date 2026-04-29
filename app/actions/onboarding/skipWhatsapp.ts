"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireOnboardingCtx, patchOnboardingState, OnboardingError } from "./_shared";

export async function skipWhatsapp(): Promise<void> {
  const ctx = await requireOnboardingCtx();
  await patchOnboardingState(ctx.orgId, {
    whatsapp: { status: "skipped", skipped: true },
  });
  await audit({
    action: "onboarding.whatsapp_skipped",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
  });
  redirect("/onboarding/connect-nuvemshop");
}

export async function markWhatsappConfigured(sessionId: string, status: string): Promise<void> {
  const ctx = await requireOnboardingCtx();
  await patchOnboardingState(ctx.orgId, {
    whatsapp: { session_id: sessionId, status },
  });
  await audit({
    action: "onboarding.whatsapp_configured",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "channel_session",
    resourceId: sessionId,
    metadata: { status },
  });
  redirect("/onboarding/connect-nuvemshop");
}

export async function skipNuvemshop(): Promise<void> {
  const ctx = await requireOnboardingCtx();
  await patchOnboardingState(ctx.orgId, {
    nuvemshop: { skipped: true },
  });
  await audit({
    action: "onboarding.nuvemshop_skipped",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
  });
  redirect("/onboarding/setup-ai");
}

export async function markNuvemshopConfigured(): Promise<void> {
  const ctx = await requireOnboardingCtx();
  await patchOnboardingState(ctx.orgId, {
    nuvemshop: { connected_at: new Date().toISOString() },
  });
  redirect("/onboarding/setup-ai");
}

export { OnboardingError };
