import { DuplicateEngineRegistrationError, UnknownEngineError } from "./errors";
import type { MessagingEngineFactory } from "./engine";
import type { EngineName } from "./types";

export class EngineRegistry {
  private readonly factories = new Map<EngineName, MessagingEngineFactory>();

  register(name: EngineName, factory: MessagingEngineFactory): void {
    if (this.factories.has(name)) {
      throw new DuplicateEngineRegistrationError(name);
    }
    this.factories.set(name, factory);
  }

  resolve(name: EngineName): MessagingEngineFactory {
    const factory = this.factories.get(name);
    if (!factory) throw new UnknownEngineError(name);
    return factory;
  }

  has(name: EngineName): boolean {
    return this.factories.has(name);
  }
}
