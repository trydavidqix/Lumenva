"use server";

/**
 * Server Action: start the Nuvemshop OAuth flow for the active org.
 *
 * Resolves auth + active org, validates env config, mints an HMAC-signed state
 * token, then redirects to Nuvemshop's authorize URL. If credentials aren't
 * configured (dev / fresh deploy), returns `{ ok: false, error: "not_configured" }`
 * so the UI can render the "configure env" card without crashing.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/require-role";
import { buildAuthorizeUrl } from "@/lib/nuvemshop/oauth";
import { getConfig } from "@/lib/nuvemshop/config";
import { issueState } from "@/lib/nuvemshop/state";

export type ConnectResult =
  | { ok: false; error: "auth_required" | "no_active_org" | "forbidden" | "not_configured" };

export async function connectNuvemshop(): Promise<ConnectResult> {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id") ?? undefined;

  // Only `admin` can wire up integrations (RBAC). `manager`/`agent`/`viewer`
  // see the UI read-only.
  const authz = await requireRole("admin", { requestId, resource: "tenant_integrations", allowPlatformAdmin: true });
  if (!authz.ok) {
    if (authz.response.status === 401) return { ok: false, error: "auth_required" };
    const code = (await authz.response.json().catch(() => ({})))?.error?.code;
    if (code === "forbidden_tenant" || authz.response.status === 404) return { ok: false, error: "no_active_org" };
    return { ok: false, error: "forbidden" };
  }

  const activeOrg = authz.org;

  const cfg = getConfig();
  if (!cfg) return { ok: false, error: "not_configured" };

  const state = issueState(activeOrg.orgId);
  const url = buildAuthorizeUrl({ appId: cfg.appId, state });
  redirect(url);
}
