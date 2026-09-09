import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { PRODUCT_AGENT_IDS } from "@/lib/agent-engine/product-agents/contracts";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { env } from "@/lib/env";
import { createProductionVoiceOutboundService } from "@/lib/voice/outbound/production";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  contact_id: z.string().uuid(),
  agent_id: z.enum(PRODUCT_AGENT_IDS),
  goal: z.string().trim().min(1).max(1_000),
}).strict();

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "voice_outbound" });
  if (!authz.ok) return authz.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_error", "Informe contato, agente e objetivo válidos.", 422, { requestId });
  }

  if (!env.INTERNAL_SECRET) {
    return fail("voice_not_configured", "Canal de ligação ainda não está configurado.", 503, { requestId });
  }

  const service = createProductionVoiceOutboundService(getRequestPool(), env.INTERNAL_SECRET);
  const result = await service.initiate({
    organizationId: authz.org.orgId,
    contactId: parsed.data.contact_id,
    agentId: parsed.data.agent_id,
    goal: parsed.data.goal,
  });

  if (result.kind === "blocked") {
    const status = result.reason === "voice_delivery_not_authorized" ? 409 : 422;
    return fail(result.reason, "A ligação não foi iniciada porque a política ou configuração de voz bloqueou a operação.", status, {
      requestId,
      ...(result.voiceCallId ? { details: { voice_call_id: result.voiceCallId } } : {}),
    });
  }

  return ok({ accepted: true, voice_call_id: result.voiceCallId }, { requestId });
}
