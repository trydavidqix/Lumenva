/**
 * CPF normalization + hashing helpers.
 *
 * `cpf_hash` is sha256(hex) of the 11-digit normalized CPF — used for exact-match
 * lookup and dedup without exposing plaintext. At-rest encryption (column
 * `cpf_encrypted bytea`) requires a server-side `encrypt_cpf` SQL function which
 * is not yet provisioned — see follow-up note in EPIC-05 commit message.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Stable sha256 hex of normalized CPF for fuzzy/exact search via `cpf_hash`.
 */
export function hashCpf(raw: string): string {
  return createHash("sha256").update(normalizeCpf(raw)).digest("hex");
}

/**
 * At-rest CPF encryption via pgcrypto-backed `encrypt_cpf` RPC.
 *
 * CPF persistence is fail-closed: a hash without its ciphertext violates the
 * at-rest PII contract and must never be accepted by a caller.
 */
export async function encryptCpfSql(
  supabase: SupabaseClient,
  plaintext: string,
): Promise<Uint8Array> {
  const { data, error } = await supabase.rpc("encrypt_cpf", { p_plaintext: plaintext });
  if (error) {
    throw new Error("CPF encryption unavailable", { cause: error });
  }
  if (!data || (typeof data === "string" ? data.length === 0 : data.byteLength === 0)) {
    throw new Error("CPF encryption unavailable");
  }
  return data as Uint8Array;
}
