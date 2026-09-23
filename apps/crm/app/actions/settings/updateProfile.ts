"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { profileSchema, type ProfileInput } from "@/lib/schemas/settings";
import { resolveActiveOrg, loadAuthUser } from "@/lib/auth/server";
import { initFirebaseAuth } from "@lumenva/db/gcp/firebase-auth";

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; error: string; details?: unknown };

export async function updateProfile(input: ProfileInput): Promise<UpdateProfileResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation_failed", details: parsed.error.flatten() };
  }

  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };

  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent") ?? null;

  try {
    const auth = initFirebaseAuth();

    // We can use the email to get the Firebase user since emails are unique.
    const fbUser = await auth.getUserByEmail(authUser.email);

    await auth.updateUser(fbUser.uid, {
      displayName: parsed.data.full_name ?? undefined,
      photoURL: parsed.data.avatar_url ?? undefined,
    });
  } catch (error: any) {
    return { ok: false, error: error.message || "update_failed" };
  }

  const activeOrg = await resolveActiveOrg(authUser);

  await audit({
    action: "profile.updated",
    actorUserId: authUser.id,
    organizationId: activeOrg?.orgId ?? null,
    resourceType: "user",
    resourceId: authUser.id,
    requestId,
    ip,
    userAgent,
    metadata: {
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
    },
  });

  // Best-effort emit (event_log is org-scoped; skip if no org).
  if (activeOrg) {
    const supabase = await createClient(); // service role? createClient is user-scoped. But wait, createClient uses Firebase session for DB access now?
    // Let's just use createClient as before.
    await supabase
      .rpc("emit_event", {
        p_event_type: "user.profile_updated",
        p_entity_kind: "user",
        p_entity_id: authUser.id,
        p_payload: { user_id: authUser.id },
        p_metadata: { request_id: requestId },
        p_organization_id: activeOrg.orgId,
      })
      .then(({ error: e }) => {
        if (e) console.error("[updateProfile] emit_event failed", e.message);
      });
  }

  revalidatePath("/app/settings/profile");
  return { ok: true };
}
