import type { NextResponse } from "next/server";
import { fail, type ApiError } from "@/lib/api/wrappers";
import { resolvePlatformAdmin, type PlatformAdminContext } from "./requirePlatformAdmin";

export type PlatformAdminApiCheck =
  | { ok: true; context: PlatformAdminContext }
  | { ok: false; response: NextResponse<ApiError> };

interface RequirePlatformAdminApiOpts {
  /** Correlaciona a resposta com o X-Request-Id da rota. */
  requestId?: string;
}

/**
 * API gate for /api/v1/system/* routes.
 * Uses the shared resolvePlatformAdmin logic but responds with
 * standard JSON errors (fail) instead of Next.js redirects.
 */
export async function requirePlatformAdminApi(
  opts: RequirePlatformAdminApiOpts = {}
): Promise<PlatformAdminApiCheck> {
  const result = await resolvePlatformAdmin();

  if (!result.ok) {
    switch (result.reason) {
      case "unauthenticated":
        return {
          ok: false,
          response: fail("unauthenticated", "Faça login para continuar.", 401, {
            requestId: opts.requestId,
          }),
        };
      case "forbidden":
      case "mfa_required":
        return {
          ok: false,
          response: fail(
            "forbidden",
            "Só o dono do servidor pode realizar esta ação.",
            403,
            { requestId: opts.requestId }
          ),
        };
      case "internal_error":
        return {
          ok: false,
          response: fail(
            "internal_error",
            "Erro ao validar permissões de administrador.",
            500,
            { requestId: opts.requestId }
          ),
        };
    }
  }

  return { ok: true, context: result.context };
}
