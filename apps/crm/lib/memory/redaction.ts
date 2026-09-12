import { createHash } from "node:crypto";

import type { MemoryEvent } from "./context-compiler";

export type PiiType = "email" | "phone" | "cpf";

export interface PiiHash {
  type: PiiType;
  hash: string;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE = /(?<!\d)\+?\d(?:[\d\s().-]*\d){8,}(?!\d)/g;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function redact(
  content: string,
  pattern: RegExp,
  type: PiiType,
  hashes: PiiHash[],
): string {
  return content.replace(pattern, (value) => {
    hashes.push({ type, hash: hash(value) });
    return `[${type.toUpperCase()}_REDACTED]`;
  });
}

export function redactMemoryEvent(event: MemoryEvent): MemoryEvent & { piiHashes: PiiHash[] } {
  const piiHashes = [...(event.piiHashes ?? [])];
  let content = event.content;
  content = redact(content, EMAIL, "email", piiHashes);
  content = redact(content, CPF, "cpf", piiHashes);
  content = redact(content, PHONE, "phone", piiHashes);

  return { ...event, content, piiHashes };
}
