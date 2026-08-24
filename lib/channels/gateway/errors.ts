import type { EngineName } from "./types";

export class DuplicateEngineRegistrationError extends Error {
  readonly code = "duplicate_engine_registration";

  constructor(readonly engineName: EngineName) {
    super(`duplicate_engine_registration: ${engineName}`);
    this.name = "DuplicateEngineRegistrationError";
  }
}

export class UnknownEngineError extends Error {
  readonly code = "unknown_engine";

  constructor(readonly engineName: EngineName) {
    super(`unknown_engine: ${engineName}`);
    this.name = "UnknownEngineError";
  }
}
