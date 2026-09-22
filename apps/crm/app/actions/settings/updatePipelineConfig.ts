"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import {
  pipelineConfigPatchSchema,
  type PipelineConfigPatch,
} from "@/lib/schemas/settings";
import { requireRole } from "@/lib/auth/require-role";

export type UpdatePipelineConfigResult =
  | { ok: true }
  | { ok: false; error: string; details?: unknown };

export async function updatePipelineConfig(
  pipelineId: string,
  patch: PipelineConfigPatch,
): Promise<UpdatePipelineConfigResult> {
  if (!pipelineId || typeof pipelineId !== "string") {
    return { ok: false, error: "invalid_request" };
  }
  const parsed = pipelineConfigPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: "validation_failed", details: parsed.error.flatten() };
  }

  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id") ?? undefined;

  const authz = await requireRole("admin", { requestId, resource: "pipeline", allowPlatformAdmin: true });
  if (!authz.ok) {
    if (authz.response.status === 401) return { ok: false, error: "unauthenticated" };
    if (authz.response.status === 403 && (await authz.response.json()).error?.code === "forbidden_tenant") {
      return { ok: false, error: "forbidden_tenant" };
    }
    return { ok: false, error: "forbidden_role" };
  }

  const authUser = authz.user;
  const activeOrg = authz.org;

  const supabase = await createClient();

  const { data: row, error: readErr } = await supabase
    .from("crm_pipelines")
    .select("vocabulary, settings, organization_id")
    .eq("id", pipelineId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: false, error: "not_found" };
  if (row.organization_id !== activeOrg.orgId) {
    return { ok: false, error: "forbidden_tenant" };
  }

  const nextVocabulary = parsed.data.vocabulary
    ? { ...((row.vocabulary as Record<string, unknown> | null) ?? {}), ...parsed.data.vocabulary }
    : ((row.vocabulary as Record<string, unknown> | null) ?? {});

  const currentSettings = (row.settings as Record<string, unknown> | null) ?? {};
  const nextSettings: Record<string, unknown> = { ...currentSettings };
  if (parsed.data.fields !== undefined) nextSettings.fields = parsed.data.fields;
  if (parsed.data.lost_reasons !== undefined) nextSettings.lost_reasons = parsed.data.lost_reasons;

  const { error } = await supabase
    .from("crm_pipelines")
    .update({ vocabulary: nextVocabulary, settings: nextSettings })
    .eq("id", pipelineId);
  if (error) return { ok: false, error: error.message };

  await audit({
    action: "pipeline.config_updated",
    actorUserId: authUser.id,
    organizationId: activeOrg.orgId,
    resourceType: "pipeline",
    resourceId: pipelineId,
    requestId,
    metadata: {
      vocabulary_changed: !!parsed.data.vocabulary,
      fields_count: parsed.data.fields?.length ?? null,
      lost_reasons_count: parsed.data.lost_reasons?.length ?? null,
    },
  });

  revalidatePath("/app/settings/tenant/pipelines");
  return { ok: true };
}
