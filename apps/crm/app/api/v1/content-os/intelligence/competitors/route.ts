import { randomUUID } from "node:crypto";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "content_os_competitors" });
  if (!authz.ok) return authz.response;
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("competitors")
      .select("id,name,website_url,status,competitor_monitors(id,status,target_url,last_checked_at)")
      .eq("organization_id", authz.org.orgId)
      .eq("status", "active")
      .order("name", { ascending: true });
    if (error) return fail("internal_error", "Não foi possível listar os concorrentes.", 500, { requestId });
    const result = (data ?? []).map((item) => {
      const monitors = item.competitor_monitors ?? [];
      const latest = monitors.reduce<{ last_checked_at: string | null } | null>((current, monitor) => {
        if (!monitor.last_checked_at) return current;
        if (!current || !current.last_checked_at || monitor.last_checked_at > current.last_checked_at) return { last_checked_at: monitor.last_checked_at };
        return current;
      }, null);
      const failed = monitors.some((monitor) => monitor.status === "failed");
      return {
        id: item.id,
        name: item.name,
        website_url: item.website_url,
        status: failed ? "failed" : monitors.length ? "active" : "pending",
        monitored_pages: monitors.length,
        last_checked_at: latest?.last_checked_at ?? null,
        last_change: null,
      };
    });
    return ok(result, { requestId });
  } catch {
    return fail("internal_error", "Não foi possível listar os concorrentes.", 500, { requestId });
  }
}
