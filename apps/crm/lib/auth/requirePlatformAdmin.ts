/**
 * Server guards for Super-Admin Platform sub-product (both layout and API).
 *
 * Flow:
 *  1. Validate JWT via getUser() (NEVER getSession on backend per CLAUDE.md).
 *  2. Confirm row in platform_admins (active = no revoked_at).
 *
 * Redirects (for layout):
 *  - no user        → /login?next=/admin
 *  - no row         → /admin/forbidden
 */
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export interface PlatformAdminInfo {
  user_id: string;
  scope: string;
}

export interface PlatformAdminContext {
  user: User;
  platformAdmin: PlatformAdminInfo;
}

type ResolveResult =
  | { ok: true; context: PlatformAdminContext }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "internal_error" };

export async function resolvePlatformAdmin(): Promise<ResolveResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  // Use the internal user_id mapping via resolve_firebase_identity
  const { data: mappedUserId, error: mapError } = await supabase.rpc("resolve_firebase_identity", {
    p_firebase_uid: user.id,
  });

  if (mapError) {
    logger.error("[auth] resolve_firebase_identity failed", { error: mapError.message });
    return { ok: false, reason: "internal_error" };
  }

  const internalUserId = mappedUserId;
  if (!internalUserId) {
    return { ok: false, reason: "forbidden" }; // Unmapped Firebase UID
  }

  // platform_admins RLS: only platform admins read; non-admins get null → forbid.
  const { data: paRow, error } = await supabase
    .from("platform_admins")
    .select("user_id, scope, revoked_at")
    .eq("user_id", internalUserId)
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
      user: { ...user, id: internalUserId },
      platformAdmin: {
        user_id: paRow.user_id,
        scope: paRow.scope,
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
      case "internal_error":
        throw new Error("Erro interno ao validar permissões de administrador.");
    }
  }

  return result.context;
}
