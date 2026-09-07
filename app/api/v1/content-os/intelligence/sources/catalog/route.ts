import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { listSourceCatalog } from "@/lib/content-os/intelligence/source-catalog";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "content_os_source_catalog" });
  if (!authz.ok) return authz.response;
  try {
    return ok(listSourceCatalog().map(({ key, name, provider, sourceType, configuration }) => ({ key, name, provider, source_type: sourceType, configuration })), { requestId });
  } catch {
    return fail("internal_error", "Não foi possível listar o catálogo de fontes.", 500, { requestId });
  }
}
