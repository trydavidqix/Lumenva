/**
 * Helper ÚNICO de autorização por role nas rotas /api/v1 (spec 13 §4 — G2-01).
 *
 * Resolve o role efetivo do usuário na org ativa e nega com 403 padronizado
 * (`fail("forbidden_role", ...)`). Nenhuma rota deve reimplementar a checagem
 * na mão (comparação com ROLE_RANK direto em rota é proibida — anti-padrão
 * "matriz advisória").
 *
 * Fluxo:
 *  1. `loadAuthUser()` — valida o JWT via Firebase session.
 *  2. `resolveActiveOrg()` — org ativa de fonte confiável.
 *  3. Lookup server-side de `user_organizations` filtrado por `user_id` + org.
 *     O user_id vem do mapping Firebase verificado; request/body nunca decide.
 *  4. Rank insuficiente → audit `authz.denied` (fire-and-forget) + 403.
 */
import type { NextResponse } from "next/server";

import { fail, type ApiError } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { resolvePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import {
  isHumanRole,
  ROLE_RANK,
  type ActiveOrg,
  type AuthUser,
  type HumanRole,
} from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type RoleCheck =
  | { ok: true; user: AuthUser; org: ActiveOrg }
  | { ok: false; response: NextResponse<ApiError> };

interface RequireRoleOpts {
  /** Correlaciona a resposta e o audit com o X-Request-Id da rota. */
  requestId?: string;
  /** resource_type gravado no audit `authz.denied` (ex.: "api_tokens"). */
  resource?: string;
  /** Platform admin (role transversal) bypassa o rank do tenant. */
  allowPlatformAdmin?: boolean;
  /**
   * Override da org onde o role é resolvido (default: org ativa do cookie).
   * Use quando a autorização é sobre a org do RECURSO (ex.: LGPD anonymize —
   * admin na org do CONTATO), resolvida de fonte confiável (query RLS-scoped),
   * NUNCA do body. O role vem do membership ativo nessa org.
   */
  organizationId?: string;
}

export async function requireRole(min: HumanRole, opts: RequireRoleOpts = {}): Promise<RoleCheck> {
  const { requestId, resource, allowPlatformAdmin = false, organizationId } = opts;

  const user = await loadAuthUser();
  if (!user) {
    return { ok: false, response: fail("unauthenticated", "Auth required.", 401, { requestId }) };
  }
  if (!isHumanRole(min)) {
    return {
      ok: false,
      response: fail("forbidden_role", "Papel de autorização inválido.", 403, { requestId }),
    };
  }

  const platformAdminAllowed = allowPlatformAdmin
    ? (await resolvePlatformAdmin()).ok
    : false;

  let org: ActiveOrg | null;
  if (organizationId) {
    const membership = user.organizations.find((o) => o.organization_id === organizationId);
    org = membership
      ? {
          orgId: membership.organization_id,
          name: membership.organization_name,
          role: membership.role,
        }
      : platformAdminAllowed
        ? { orgId: organizationId, name: "—", role: "viewer" }
        : null;
  } else {
    org = await resolveActiveOrg(user);
  }
  if (!org) {
    return {
      ok: false,
      response: fail("forbidden_tenant", "Sem organização ativa.", 403, { requestId }),
    };
  }

  if (platformAdminAllowed) {
    return { ok: true, user, org };
  }

  // Firebase is the auth authority. The legacy RLS function reads auth.uid(),
  // which is a Supabase principal and cannot represent the Firebase session
  // cookie. Keep this service-role lookup narrow and require both trusted
  // identity and trusted organization predicates.
  const { data: membership, error } = await createAdminClient()
    .from("user_organizations")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", org.orgId)
    .is("revoked_at", null)
    .not("accepted_at", "is", null)
    .maybeSingle();
  const effectiveRole = membership?.role ?? null;
  if (error) {
    return {
      ok: false,
      response: fail("internal_error", "Não foi possível validar permissões.", 500, { requestId }),
    };
  }

  const effectiveHumanRole = isHumanRole(effectiveRole) ? effectiveRole : null;
  const rank = effectiveHumanRole ? ROLE_RANK[effectiveHumanRole] : 0;
  if (!effectiveHumanRole || rank < ROLE_RANK[min]) {
    void audit({
      action: "authz.denied",
      actorUserId: user.id,
      organizationId: org.orgId,
      resourceType: resource ?? null,
      requestId,
      metadata: { required_role: min, effective_role: effectiveRole ?? null },
    });
    return {
      ok: false,
      response: fail("forbidden_role", `Permissão insuficiente. Requer role >= ${min}.`, 403, {
        requestId,
      }),
    };
  }

  return { ok: true, user, org: { ...org, role: effectiveHumanRole } };
}
