export interface MetaDependencies {
  fetch: typeof fetch;
  logger: {
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, ctx?: Record<string, unknown>) => void;
    warn: (msg: string, ctx?: Record<string, unknown>) => void;
  };
  getConfig: (key: string) => Promise<string | null>;
  idempotencyStore: {
    has: (key: string) => Promise<boolean>;
    set: (key: string, ttlSeconds: number) => Promise<void>;
  };
}
