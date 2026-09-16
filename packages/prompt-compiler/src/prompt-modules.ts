import { createHash } from "node:crypto";
import type { InstructionLayer, InstructionModule } from "./instruction-hierarchy.js";

export interface PromptModule extends InstructionModule {
  readonly provenance: PromptProvenance;
}

export interface PromptProvenance {
  readonly source: string;
  readonly locator: string;
}

export interface ExternalContent {
  readonly source: string;
  readonly version: string;
  readonly content: string;
  readonly locator?: string;
}

export interface PromptModuleInput {
  readonly id: string;
  readonly version: string;
  readonly layer: Exclude<InstructionLayer, "external">;
  readonly content: string;
  readonly provenance: PromptProvenance;
}

export function createPromptModule(input: PromptModuleInput): PromptModule {
  const id = input.id.trim();
  const version = input.version.trim();
  const content = input.content.trim();
  if (!id || !version || !content) {
    throw new Error("prompt_module_fields_required");
  }
  if (input.provenance.source.trim() === "" || input.provenance.locator.trim() === "") {
    throw new Error("prompt_module_provenance_required");
  }
  return { ...input, id, version, content };
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
