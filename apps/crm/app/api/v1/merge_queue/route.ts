import { randomUUID } from "node:crypto";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "merge_queue" });
  if (!authz.ok) return authz.response;
  const { data, error } = await (await createClient())
    .from("merge_queue")
    .select("id, organization_id, candidates, reason, status, created_at")
    .eq("organization_id", authz.org.orgId).eq("status", "pending").order("created_at", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data ?? [], { requestId });
}
