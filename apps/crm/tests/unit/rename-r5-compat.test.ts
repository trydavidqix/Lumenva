import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { readHeaderWithLegacy } from "@/lib/http/compat";
import {
  IMPERSONATE_COOKIE_NAME,
  IMPERSONATE_COOKIE_NAME_LEGACY,
  readImpersonateCookie,
} from "@/lib/impersonate/names";
import {
  normalizeSupabaseCookies,
  SUPABASE_COOKIE_NAME,
  SUPABASE_COOKIE_NAME_LEGACY,
} from "@/lib/supabase/cookie-compat";

describe("compatibilidade HTTP do rename R5", () => {
  it("lê apenas o header novo", () => {
    const headers = new Headers({ "x-lumenva-signature": "novo" });
    expect(readHeaderWithLegacy(headers, "x-lumenva-signature", "x-deskcomm-signature")).toBe("novo");
  });

  it("faz fallback para o header antigo", () => {
    const headers = new Headers({ "x-deskcomm-signature": "antigo" });
    expect(readHeaderWithLegacy(headers, "x-lumenva-signature", "x-deskcomm-signature")).toBe("antigo");
  });

  it("dá precedência ao header novo quando ambos existem", () => {
    const headers = new Headers({ "x-lumenva-signature": "novo", "x-deskcomm-signature": "antigo" });
    expect(readHeaderWithLegacy(headers, "x-lumenva-signature", "x-deskcomm-signature")).toBe("novo");
  });

  it("lê cookie antigo e novo, com precedência do novo", () => {
    const onlyLegacy = new Map([[IMPERSONATE_COOKIE_NAME_LEGACY, { value: "sessao-antiga" }]]);
    expect(readImpersonateCookie((name) => onlyLegacy.get(name))).toBe("sessao-antiga");

    const both = new Map([
      [IMPERSONATE_COOKIE_NAME_LEGACY, { value: "sessao-antiga" }],
      [IMPERSONATE_COOKIE_NAME, { value: "sessao-nova" }],
    ]);
    expect(readImpersonateCookie((name) => both.get(name))).toBe("sessao-nova");
  });

  it("mantém o nome novo e a remoção explícita do legado", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/crm/lib/impersonate/names.ts"), "utf8");
    expect(source).toContain('"lumenva-impersonate"');
    expect(source).toContain('"deskcomm-impersonate"');
  });

  it("confirma o nome do pacote novo e pacote privado único", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "apps/crm/package.json"), "utf8")) as {
      name: string;
      private: boolean;
    };
    expect(pkg.name).toBe("lumenva-crm");
    expect(pkg.private).toBe(true);
  });

  it("normaliza cookie Supabase legado e preserva sessão nova quando presente", () => {
    expect(normalizeSupabaseCookies([{ name: `${SUPABASE_COOKIE_NAME_LEGACY}_0`, value: "old" }])).toEqual([
      { name: `${SUPABASE_COOKIE_NAME}_0`, value: "old" },
    ]);
    const both = [
      { name: `${SUPABASE_COOKIE_NAME_LEGACY}_0`, value: "old" },
      { name: `${SUPABASE_COOKIE_NAME}_0`, value: "new" },
    ];
    expect(normalizeSupabaseCookies(both)).toEqual(both);
  });
});
