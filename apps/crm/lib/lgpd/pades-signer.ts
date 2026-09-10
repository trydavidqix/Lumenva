/**
 * PAdES signing for LGPD export PDFs.
 *
 * MVP: real PAdES requires P12 cert provisioning that's still pending. When
 * `LGPD_SIGNING_KEY` is unset, we render the PDF with an "unsigned" warning
 * banner (caller already does that), compute SHA-256 over the buffer for
 * integrity logging, and surface a `signed_pades=false` + `warning='pades_key_missing'`
 * flag so downstream audit captures the gap.
 *
 * When the key + cert are wired in, swap `signPdfPades` to use
 * `node-signpdf` + `@signpdf/signer-p12` (interface stays identical).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export interface SignResult {
  signed: Buffer;
  sha256: string;
  signed_pades: boolean;
  warning?: "pades_key_missing";
}

export interface PadesVerification {
  valid: boolean;
  reason: "signature_backend_unavailable" | "empty_document";
}

/** Loads a test-only PKCS#12 fixture; production callers must provide their own key. */
export function loadP12Fixture(path: string): Buffer {
  const fixture = readFileSync(path);
  if (fixture.length === 0) throw new Error("p12_fixture_empty");
  return fixture;
}

/** Verification remains fail-closed until the approved PAdES backend is provisioned. */
export function verifyPdfSignature(buffer: Buffer): PadesVerification {
  if (buffer.length === 0) return { valid: false, reason: "empty_document" };
  return { valid: false, reason: "signature_backend_unavailable" };
}

export function isPadesConfigured(): boolean {
  const key = process.env.LGPD_SIGNING_KEY;
  return Boolean(key && key.length > 10);
}

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Sign (or stub-sign) a PDF buffer.
 *
 * Caller is expected to have ALREADY rendered the PDF with the unsigned
 * warning banner when `isPadesConfigured()` returns false.
 */
export async function signPdfPades(buffer: Buffer): Promise<SignResult> {
  if (!isPadesConfigured()) {
    return {
      signed: buffer,
      sha256: sha256Hex(buffer),
      signed_pades: false,
      warning: "pades_key_missing",
    };
  }

  // TODO(LGPD): wire node-signpdf + @signpdf/signer-p12 once cert is provisioned.
  // Until then, even with the key set we degrade to unsigned to avoid producing
  // a falsely-marked-signed document.
  return {
    signed: buffer,
    sha256: sha256Hex(buffer),
    signed_pades: false,
    warning: "pades_key_missing",
  };
}
