import { sha256Hex } from "./prompt-modules.js";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export interface PromptVersion {
  readonly id: string;
  readonly version: string;
  readonly compilerVersion: string;
}

export interface ModuleProvenance {
  readonly id: string;
  readonly version: string;
  readonly layer: string;
  readonly source: string;
  readonly locator: string;
  readonly contentSha256: string;
}

export interface ExternalProvenance {
  readonly source: string;
  readonly version: string;
  readonly locator?: string;
  readonly contentSha256: string;
}

export interface PromptProvenance {
  readonly promptId: string;
  readonly promptVersion: string;
  readonly compilerVersion: string;
  readonly modules: readonly ModuleProvenance[];
  readonly external: readonly ExternalProvenance[];
  readonly compiledSha256: string;
}

export function assertPromptVersion(version: PromptVersion): void {
  if (!version.id.trim() || !version.version.trim() || !version.compilerVersion.trim()) {
    throw new Error("prompt_version_fields_required");
  }
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, nested]) => JSON.stringify(key) + ":" + canonicalJson(nested))
      .join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

export function versionFingerprint(version: PromptVersion): string {
  assertPromptVersion(version);
  return sha256Hex(canonicalJson(version));
}
