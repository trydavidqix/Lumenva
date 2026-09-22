/**
 * Server-side auth helpers — load AuthUser, resolve active org, gate routes.
 *
 * Uses the service-role admin client to read tenant-scoped tables
 * (`user_organizations`, `platform_admins`, `organizations`) — RLS bypass is
 * intentional here because we resolve the user from the validated JWT first
 * and then filter by `user_id` (a trusted source).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import type { AuthUser, Role, UserOrgMembership, ActiveOrg } from "./types";

const ACTIVE_ORG_COOKIE = "active_org";

interface RawMembershipRow {
  organization_id: string;
  role: string;
  organizations: { display_name: string } | { display_name: string }[] | null;
}

/**
 * Loads the AuthUser for the current request. Returns null if unauthenticated.
 * Use only in Server Components / Route Handlers / Server Actions.
 *
 * Uses the user-scoped server client (cookie session). RLS policies allow:
 * - user_organizations: user_id = auth.uid() (user_orgs_select)
 * - organizations: id IN fn_user_org_ids()  (orgs_select)
 * - platform_admins: only platform admins read (so non-admins get null — correct)
 */
export async function loadAuthUser(): Promise<AuthUser | null> {
  const { getSessionUid, adminAuth } = await import("@/lib/firebase/server");
  const { createAdminClient } = await import("@/lib/supabase/admin");

  const uid = await getSessionUid();
  if (!uid) return null;

  let firebaseUser;
  try {
    firebaseUser = await adminAuth.getUser(uid);
  } catch (err) {
    return null;
  }

  const supabaseAdmin = createAdminClient();

  // Platform admin? (active = no revoked_at).
  const { data: paRow, error: paErro } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id, revoked_at")
    .eq("user_id", uid)
    .is("revoked_at", null)
    .maybeSingle();

  // Org memberships (only active = not revoked, accepted)
  const { data: rawMemberships, error: membErro } = await supabaseAdmin
    .from("user_organizations")
    .select("organization_id, role, organizations(display_name)")
    .eq("user_id", uid)
    .is("revoked_at", null);

  if (paErro || membErro) {
    const detalhe = (paErro ?? membErro)!;
    logger.error("[auth] não foi possível resolver permissões do usuário", {
      user_id: uid,
      onde: paErro ? "platform_admins" : "user_organizations",
      code: detalhe.code,
      message: detalhe.message,
    });
    throw new Error(
      `auth_permissions_unavailable: ${detalhe.message} — permissões não puderam ser ` +
        `resolvidas; a sessão NÃO foi rebaixada por decisão de autorização.`,
    );
  }

  const rows = (rawMemberships ?? []) as RawMembershipRow[];
  const memberships: UserOrgMembership[] = rows.map((row) => {
    const orgs = row.organizations;
    const name = Array.isArray(orgs) ? (orgs[0]?.display_name ?? "—") : (orgs?.display_name ?? "—");
    return {
      organization_id: row.organization_id,
      organization_name: name,
      role: row.role as Role,
    };
  });

  return {
    id: uid,
    email: firebaseUser.email ?? "",
    full_name: firebaseUser.displayName ?? null,
    avatar_url: firebaseUser.photoURL ?? null,
    is_platform_admin: !!paRow,
    organizations: memberships,
  };
}

/**
 * Resolves the active organization for the current request.
 * Priority: cookie `active_org` (if member of) → first membership.
 * Returns null if user has zero memberships.
 */
export async function resolveActiveOrg(authUser: AuthUser): Promise<ActiveOrg | null> {
  if (authUser.organizations.length === 0) return null;
  const store = await cookies();
  const cookieOrg = store.get(ACTIVE_ORG_COOKIE)?.value;
  if (cookieOrg) {
    const found = authUser.organizations.find((o) => o.organization_id === cookieOrg);
    if (found) {
      return { orgId: found.organization_id, name: found.organization_name, role: found.role };
    }
  }
  const first = authUser.organizations[0];
  if (!first) return null;
  return { orgId: first.organization_id, name: first.organization_name, role: first.role };
}

/**
 * For Server Components / Server Actions in /app/(app)/* routes — guarantees
 * an authenticated user. Redirects to /login if not.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await loadAuthUser();
  if (!user) redirect("/login");
  return user;
}
