/**
 * PAdES signing/verification boundary for LGPD exports.
 *
 * The real P12 certificate/backend is intentionally not provisioned yet.
 * Verification therefore remains fail-closed: a fixture can be loaded and
 * identity-checked, but no document is ever reported as signed without the
 * approved PAdES backend.
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
  reason: "signature_backend_unavailable" | "empty_document" | "invalid_fixture";
}

const TEST_FIXTURE_SHA256 = "0c53d00ed2f1da83cc87ddac075c26860de7ac0fa2b57e374d880e95e6faaa08";

/** Loads a test-only PKCS#12 fixture; production callers must provide their own key. */
export function loadP12Fixture(path: string): Buffer {
  const fixture = readFileSync(path);
  if (fixture.length === 0) throw new Error("p12_fixture_empty");
  return fixture;
}

/** Confirms the supplied fixture is the checked-in test certificate, by hash. */
export function isApprovedTestP12(fixture: Buffer): boolean {
  return createHash("sha256").update(fixture).digest("hex") === TEST_FIXTURE_SHA256;
}

/** Never claims a signature until the approved PAdES backend is provisioned. */
export function verifyPdfSignature(buffer: Buffer, p12Fixture?: Buffer): PadesVerification {
  if (buffer.length === 0) return { valid: false, reason: "empty_document" };
  if (p12Fixture !== undefined && !isApprovedTestP12(p12Fixture)) {
    return { valid: false, reason: "invalid_fixture" };
  }
  return { valid: false, reason: "signature_backend_unavailable" };
}

export function isPadesConfigured(): boolean {
  const key = process.env.LGPD_SIGNING_KEY;
  return Boolean(key && key.length > 10);
}

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function signPdfPades(buffer: Buffer): Promise<SignResult> {
  return { signed: buffer, sha256: sha256Hex(buffer), signed_pades: false, warning: "pades_key_missing" };
}
