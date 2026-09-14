import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { IMPERSONATE_COOKIE_NAME, readImpersonateCookie } from "@/lib/impersonate/names";
import { normalizeSupabaseCookies, SUPABASE_COOKIE_NAME } from "@/lib/supabase/cookie-compat";

describe("identidade canônica Lumenva", () => {
  it("lê somente o cookie de impersonação Lumenva", () => {
    const cookies = new Map([[IMPERSONATE_COOKIE_NAME, { value: "sessao-lumenva" }]]);
    expect(readImpersonateCookie((name) => cookies.get(name))).toBe("sessao-lumenva");
  });

  it("mantém o nome canônico do cookie de impersonação", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/crm/lib/impersonate/names.ts"), "utf8");
    expect(source).toContain('"lumenva-impersonate"');
  });

  it("confirma o nome do pacote Lumenva e pacote privado único", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "apps/crm/package.json"), "utf8")) as {
      name: string;
      private: boolean;
    };
    expect(pkg.name).toBe("lumenva-crm");
    expect(pkg.private).toBe(true);
  });

  it("preserva cookies Supabase canônicos sem tradução de identidade", () => {
    const cookies = [{ name: `${SUPABASE_COOKIE_NAME}_0`, value: "new" }];
    expect(normalizeSupabaseCookies(cookies)).toEqual(cookies);
  });
});
