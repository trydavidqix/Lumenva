export type NuvemshopCircuitState = "closed" | "open" | "half_open";

export interface NuvemshopCircuitHealth {
  state: NuvemshopCircuitState;
  healthy: boolean;
  failureCount: number;
}

export interface NuvemshopCircuitOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  now?: () => number;
}

export class NuvemshopCircuitBreaker {
  private state: NuvemshopCircuitState = "closed";
  private failureCount = 0;
  private openedAt: number | null = null;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(options: NuvemshopCircuitOptions = {}) {
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 3);
    this.cooldownMs = Math.max(0, options.cooldownMs ?? 30_000);
    this.now = options.now ?? Date.now;
  }

  health(): NuvemshopCircuitHealth {
    return { state: this.state, healthy: this.state !== "open", failureCount: this.failureCount };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (this.openedAt === null || this.now() - this.openedAt < this.cooldownMs) {
        throw new Error("nuvemshop_circuit_open");
      }
      this.state = "half_open";
    }
    try {
      const result = await operation();
      this.state = "closed";
      this.failureCount = 0;
      this.openedAt = null;
      return result;
    } catch (error) {
      this.failureCount += 1;
      if (this.failureCount >= this.failureThreshold) {
        this.state = "open";
        this.openedAt = this.now();
      }
      throw error;
    }
  }

  rollback(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.openedAt = null;
  }
}
