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
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFirebaseIdentity } from "./firebase-identity";
import { isHumanRole, type AuthUser, type Role, type UserOrgMembership, type ActiveOrg } from "./types";

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
 * Uses the verified Firebase session cookie, then resolves the canonical
 * Firebase UID -> internal user ID mapping. The admin client is limited to
 * this server-side identity/permission lookup and always filters by that
 * resolved internal user ID; it is not a business-data client.
 */
export async function loadAuthUser(): Promise<AuthUser | null> {
  const identity = await resolveFirebaseIdentity();
  if (!identity) return null;

  const admin = createAdminClient();
  const { data: paRow, error: paErro } = await admin
    .from("platform_admins")
    .select("user_id, revoked_at")
    .eq("user_id", identity.userId)
    .is("revoked_at", null)
    .maybeSingle();

  const { data: rawMemberships, error: membErro } = await admin
    .from("user_organizations")
    .select("organization_id, role, organizations(display_name)")
    .eq("user_id", identity.userId)
    .is("revoked_at", null)
    .not("accepted_at", "is", null);

  /**
   * FALHA ALTO, não baixo.
   *
   * Antes, o erro destas duas queries era descartado e `rawMemberships` nulo virava
   * `[]` — ou seja, "usuário sem organização". O resultado é que uma instabilidade do
   * banco chega ao operador como **"você não pertence a nenhuma organização"**: as
   * telas de admin somem, as rotas devolvem 403, e nada indica que a causa é
   * infraestrutura.
   *
   * Medido em 2026-07-30: com o PostgREST devolvendo `name resolution failed` depois
   * de um restart do Docker, TODOS os cards de admin sumiram do hub de configurações.
   * Custou seis diagnósticos errados — build velho, processo velho, cache, filtro de
   * papel — antes de alguém olhar a causa real.
   *
   * Degradar permissão em silêncio é o pior desfecho possível num caminho de auth:
   * parece uma decisão de autorização e é um defeito de infra. Melhor estourar e
   * mostrar erro do que renderizar uma UI mentirosa.
   */
  if (paErro || membErro) {
    const detalhe = (paErro ?? membErro)!;
    logger.error("[auth] não foi possível resolver permissões do usuário", {
      user_id: identity.userId,
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
  const memberships: UserOrgMembership[] = rows.filter((row) => isHumanRole(row.role)).map((row) => {
    const orgs = row.organizations;
    const name = Array.isArray(orgs) ? (orgs[0]?.display_name ?? "—") : (orgs?.display_name ?? "—");
    return {
      organization_id: row.organization_id,
      organization_name: name,
      role: row.role as Role,
    };
  });

  return {
    id: identity.userId,
    email: identity.email,
    full_name: identity.fullName,
    avatar_url: identity.avatarUrl,
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

/**
 * Returns true if the current session has at least one verified TOTP factor.
 * Use only in Server Components / Server Actions (cookie session).
 * Deprecated in F4: always returns false to disable MFA enforcement.
 */
export async function isMfaEnrolled(): Promise<boolean> {
  return false;
}

/**
 * MFA enforcement policy: platform admins and tenant `admin` role MUST enroll.
 * `manager`/`agent`/`viewer` are optional in MVP.
 * Deprecated in F4: always returns false to disable MFA enforcement.
 */
export function requiresMfa(role: Role | undefined, isPlatformAdmin: boolean): boolean {
  return false;
}
