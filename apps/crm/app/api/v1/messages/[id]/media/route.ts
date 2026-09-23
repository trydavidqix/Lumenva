// app/api/v1/messages/[id]/media/route.ts
/**
 * GET /api/v1/messages/[id]/media — acesso autenticado à mídia da mensagem.
 * Persistida → 302 pra signed URL (TTL 1h) do bucket whatsapp-media.
 * Ainda não persistida (janela até o worker rodar) → proxy dos bytes do WAHA.
 * A URL desta rota é usada diretamente como src de <img>/<video>/<audio>
 * (cookie de sessão vai junto por ser same-origin; RLS decide o acesso).
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { logger } from "@/lib/logger";
import { fetchWahaMedia } from "@/lib/messaging/media/waha-source";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGcsObjectStore } from "@lumenva/db/storage/gcs";
import { getGcsBucket } from "@lumenva/db/gcp/cloud-storage";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_S = 3600;

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id: messageId } = await ctx.params;
  const admin = createAdminClient();

  const authUser = await loadAuthUser();
  if (!authUser) {
    return fail("unauthenticated", "Auth required.", 401, { requestId });
  }
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) {
    return fail("no_active_org", "No active organization.", 403, { requestId });
  }

  // Client de sessão: RLS garante que a mensagem pertence a uma org do usuário.
  // Filtro explícito de organization_id por doutrina (defense-in-depth).
  const { data: msg, error } = await admin
    .from("messages")
    .select("id, media_url, media_mime, media_storage_path")
    .eq("id", messageId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (error) {
    return fail("internal_error", "Erro ao buscar mensagem.", 500, { requestId });
  }
  if (!msg || (!msg.media_storage_path && !msg.media_url)) {
    return fail("not_found", "Mensagem sem mídia.", 404, { requestId });
  }

  if (msg.media_storage_path) {
    try {
      const bucket = getGcsBucket();
      const store = createGcsObjectStore(bucket);
      const signedUrl = await store.createReadUrl(
        { provider: 'gcs', bucket: 'whatsapp-media', key: msg.media_storage_path },
        SIGNED_URL_TTL_S
      );
      const response = NextResponse.redirect(signedUrl, 302);
      response.headers.set("X-Request-Id", requestId);
      return response;
    } catch (signErr) {
      logger.error("messages.media: createSignedUrl failed", { error: signErr instanceof Error ? signErr.message : String(signErr) });
    }
  }

  // Fallback: worker ainda não persistiu — proxy server-side do WAHA
  // (o browser não alcança o WAHA nem tem a api key).
  if (msg.media_url) {
    try {
      const media = await fetchWahaMedia(msg.media_url, msg.media_mime);
      return new Response(new Uint8Array(media.buffer), {
        status: 200,
        headers: {
          "Content-Type": media.mime,
          "Cache-Control": "private, max-age=60",
          "X-Request-Id": requestId,
        },
      });
    } catch {
      return fail("bad_gateway", "Mídia indisponível no momento.", 502, { requestId });
    }
  }

  return fail("not_found", "Mensagem sem mídia.", 404, { requestId });
}
