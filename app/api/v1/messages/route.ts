/**
 * POST /api/v1/messages — envia mensagem outbound (handler em ./_handler.ts).
 *
 * Honra `Idempotency-Key` (TTL 24h) por `.claude/rules/api-contract.md`: um
 * retry de cliente após timeout reenviava a mensagem de verdade pelo canal —
 * o MCP tool equivalente (`crm_send_whatsapp_message`) já protegia isso, esta
 * rota REST ficava de fora.
 */
import { createHash, randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ApiError } from "@/lib/api/types";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { sendMessageSchema, validateRequest, type SendMessageInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

import { sendMessageHandler } from "./_handler";

export const dynamic = "force-dynamic";

const ENDPOINT_TAG = "/api/v1/messages";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function hashInput(input: SendMessageInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        conversation_id: input.conversation_id,
        type: input.type,
        body: input.body,
        media_url: input.media_url,
        media_mime: input.media_mime,
      }),
    )
    .digest("hex");
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const supabase = await createClient();

  // spec 13 §4: escrita é agent+ (viewer é read-only).
  const authz = await requireRole("agent", { requestId, resource: "messages" });
  if (!authz.ok) return authz.response;
  const user = authz.user;
  const activeOrg = authz.org;

  let input;
  try {
    input = await validateRequest(sendMessageSchema, req);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }

  const requestHash = hashInput(input as SendMessageInput);
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");

  // Reserva ANTES de enviar (não select-then-insert): a constraint única
  // (organization_id, key, endpoint) decide quem manda de verdade. Um
  // check-then-act aqui deixaria duas requisições concorrentes com a MESMA
  // key passarem ambas pelo lookup antes de qualquer uma gravar, e as duas
  // enviariam a mensagem real pelo canal — exatamente o que Idempotency-Key
  // existe para impedir. `status_code=0`/`response_body={}` é placeholder de
  // reserva; vira a resposta real depois do envio, ou some se o envio falhar.
  if (idempotencyKey) {
    const { error: reserveErr } = await supabase.from("idempotency_keys").insert({
      organization_id: activeOrg.orgId,
      endpoint: ENDPOINT_TAG,
      key: idempotencyKey,
      request_hash: requestHash,
      response_body: {},
      status_code: 0,
      expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
    });

    if (reserveErr) {
      if (reserveErr.code !== "23505") {
        return fail("internal_error", reserveErr.message, 500, { requestId });
      }

      const { data: existingKey } = await supabase
        .from("idempotency_keys")
        .select("request_hash, response_body, status_code")
        .eq("organization_id", activeOrg.orgId)
        .eq("endpoint", ENDPOINT_TAG)
        .eq("key", idempotencyKey)
        .maybeSingle();

      if (!existingKey || existingKey.request_hash !== requestHash) {
        return fail(
          "idempotency_conflict",
          "Idempotency-Key já usada com payload diferente.",
          409,
          { requestId },
        );
      }
      if (existingKey.status_code === 0) {
        return fail(
          "state_conflict",
          "Requisição com esta Idempotency-Key ainda em andamento — tente novamente em instantes.",
          409,
          { requestId },
        );
      }
      return ok(existingKey.response_body as Record<string, unknown>, {
        status: 201,
        requestId,
      });
    }
  }

  try {
    const message = await sendMessageHandler(
      supabase,
      {
        organization_id: activeOrg.orgId,
        actor: { type: "user", id: user.id },
        requestId,
      },
      input as SendMessageInput,
    );

    if (idempotencyKey) {
      await supabase
        .from("idempotency_keys")
        .update({ response_body: message, status_code: 201 })
        .eq("organization_id", activeOrg.orgId)
        .eq("endpoint", ENDPOINT_TAG)
        .eq("key", idempotencyKey)
        .then(({ error }) => {
          if (error) {
            console.error("[messages.send] idempotency cache write failed", error.message);
          }
        });
    }

    return ok(message, { status: 201, requestId });
  } catch (err) {
    // Libera a chave: a reserva não virou envio real, então uma retentativa
    // com a MESMA key precisa poder tentar de novo, não travar em 409 pra sempre.
    if (idempotencyKey) {
      await supabase
        .from("idempotency_keys")
        .delete()
        .eq("organization_id", activeOrg.orgId)
        .eq("endpoint", ENDPOINT_TAG)
        .eq("key", idempotencyKey)
        .eq("status_code", 0)
        .then(({ error }) => {
          if (error) {
            console.error("[messages.send] idempotency reservation cleanup failed", error.message);
          }
        });
    }
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, { requestId });
    }
    throw err;
  }
}
