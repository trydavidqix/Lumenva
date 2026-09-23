/**
 * GET /api/v1/auth/realtime-token — o token que o canal Realtime precisa.
 *
 * Por que existe: o cookie de sessão é httpOnly (CLAUDE.md), então o
 * supabase-js do browser NÃO enxerga a sessão e assina os canais como ANÔNIMO.
 * O Realtime aplica RLS por canal: canal anônimo assina, recebe "ok", e nunca
 * recebe evento nenhum — falha silenciosa que parece saúde. O fetch do board já
 * tinha sido movido para rota de API por essa mesma razão (ver useBoard);
 * o realtime ficou para trás.
 *
 * A sessão continua morando no cookie httpOnly. Isto entrega apenas o
 * access_token, em memória, para o cliente autenticar o WebSocket — nunca
 * gravado em storage, e some no reload.
 *
 * NÃO ESTENDA ESTE ENDPOINT. Ele existe para UM consumidor: o socket do
 * Realtime. Precisa de token no browser para outra coisa? A resposta certa é
 * rota de API no servidor, não mais um campo aqui — senão a exceção vira porta.
 *
 * `cache-control: no-store` é obrigatório e não é zelo abstrato: o corpo de
 * sucesso É um token de sessão, e o deploy tem Caddy na frente. Um 200 cacheado
 * serviria o token de um usuário para outro. O repo já decidiu isso duas vezes
 * para carga MENOS sensível — as rotas de QR (`channel-sessions/[id]/qr`,
 * `onboarding/whatsapp/qr`) setam no-store porque um QR é segredo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { getServerSession } from "@/lib/firebase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const session = await getServerSession();

  if (!session) {
    return fail("unauthenticated", "Auth required.", 401, { requestId, headers: NO_STORE });
  }

  // F4 Auth Migration: Supabase Auth is removed and Firebase Admin does not
  // issue Supabase-compatible JWTs for Realtime. This breaks the websocket
  // authorization mechanism, requiring either a custom JWT minting service
  // or proxying realtime events through our own API.
  return fail(
    "not_implemented",
    "blocker: Firebase migration removes Supabase Auth. Cannot issue Realtime JWTs.",
    501,
    { requestId, headers: NO_STORE },
  );
}
