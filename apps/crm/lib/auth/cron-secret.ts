/**
 * Verificação do secret interno de crons (`INTERNAL_CRON_SECRET` |
 * `INTERNAL_SECRET`), compartilhada por todos os crons/rotas host↔app.
 *
 * `timingSafeEqual`, não `Array.prototype.includes`/`===`: comparação de
 * secret precisa ser constant-time — `.includes()` curto-circuita no
 * primeiro byte diferente, vazando por timing quantos bytes do segredo
 * certo o atacante já acertou.
 */
import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

export function cronSecretMatches(provided: string | null | undefined): boolean {
  if (!provided) return false;
  const accepted = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean) as string[];
  if (accepted.length === 0) return false;
  const providedBuf = Buffer.from(provided);
  return accepted.some((expected) => {
    const expectedBuf = Buffer.from(expected);
    // timingSafeEqual LANÇA se os tamanhos diferirem — o curto-circuito aqui
    // evita que um secret de tamanho errado vire 500 em vez de "não bate".
    return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
  });
}

/** Extrai o Bearer token do header `Authorization`, ou string vazia. */
export function bearerFromHeader(authHeader: string | null | undefined): string {
  const h = authHeader ?? "";
  return h.startsWith("Bearer ") ? h.slice("Bearer ".length).trim() : "";
}
