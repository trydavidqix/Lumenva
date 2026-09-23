/**
 * Server guards for Super-Admin Platform sub-product (both layout and API).
 *
 * Flow:
 *  1. Validate the Firebase session cookie (revocation checked server-side).
 *  2. Resolve Firebase UID -> canonical internal user ID.
 *  3. Confirm row in platform_admins (active = no revoked_at).
 *
 * Redirects (for layout):
 *  - no user        → /login?next=/admin
 *  - no row         → /admin/forbidden
 *  - F4 does not enforce MFA.
 */
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { resolveFirebaseIdentity } from "./firebase-identity";

export interface PlatformAdminInfo {
  user_id: string;
  scope: string;
  mfa_required: boolean;
}

export interface PlatformAdminContext {
  user: {
    id: string;
    email: string | null;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
  };
  platformAdmin: PlatformAdminInfo;
}

type ResolveResult =
  | { ok: true; context: PlatformAdminContext }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "mfa_required" | "internal_error" };

export async function resolvePlatformAdmin(): Promise<ResolveResult> {
  const identity = await resolveFirebaseIdentity();
  if (!identity) {
    return { ok: false, reason: "unauthenticated" };
  }

  const { data: paRow, error } = await createAdminClient()
    .from("platform_admins")
    .select("user_id, scope, mfa_required, revoked_at")
    .eq("user_id", identity.userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    logger.error("[auth] platform_admins query failed", { error: error.message });
    return { ok: false, reason: "internal_error" };
  }

  if (!paRow) {
    return { ok: false, reason: "forbidden" };
  }

  return {
    ok: true,
    context: {
      user: {
        id: identity.userId,
        email: identity.email,
        app_metadata: identity.appMetadata,
        user_metadata: identity.userMetadata,
      },
      platformAdmin: {
        user_id: paRow.user_id,
        scope: paRow.scope,
        mfa_required: false, // F4 disables MFA enforcement
      },
    }
  };
}

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const result = await resolvePlatformAdmin();

  if (!result.ok) {
    switch (result.reason) {
      case "unauthenticated":
        redirect("/login?next=/admin");
      case "forbidden":
        redirect("/admin/forbidden");
      case "mfa_required":
        redirect("/login/mfa?next=/admin");
      case "internal_error":
        throw new Error("Erro interno ao validar permissões de administrador.");
    }
  }

  return result.context;
}
