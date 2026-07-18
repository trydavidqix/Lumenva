import { afterEach, describe, expect, it, vi } from "vitest";

import { cookieSecure } from "./cookie-secure";

/** Achado nº 8 (VPS): Secure=true em HTTP descartava o cookie → login em loop. */
describe("cookieSecure — derivado do protocolo do app, não de NODE_ENV", () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD };
    vi.unstubAllEnvs();
  });

  it("https → Secure (produção com TLS)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://crm.exemplo.com.br");
    expect(cookieSecure()).toBe(true);
  });

  it("http → NÃO-Secure (self-host sem TLS — o caso da VPS em porta alta)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://129.121.45.100:18080");
    vi.stubEnv("NODE_ENV", "production");
    expect(cookieSecure()).toBe(false);
  });

  it("sem APP_URL → fallback no comportamento antigo (NODE_ENV)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(cookieSecure()).toBe(true);
  });
});
