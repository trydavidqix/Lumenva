/**
 * Issue #66 nasceu porque `AGENTS.md` duplicava versões de bibliotecas à mão e
 * essa cópia envelhecia. A arquitetura atual remove a duplicação em vez de
 * tentar sincronizá-la para sempre: versões mutáveis vivem em `package.json`
 * (e resolução exata no lockfile); `AGENTS.md` é contrato portátil.
 *
 * Este gate protege a causa raiz do drift: se alguém voltar a escrever
 * "Next.js 16.3", "Zod 4" etc. no contrato portátil, a suíte reprova antes que
 * uma versão congelada possa voltar a orientar agentes depois de um upgrade.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

/** Como o nome pode aparecer no AGENTS.md → nome canônico no package.json. */
const BIBLIOTECAS: Array<{ rotulo: string; pacote: string }> = [
  { rotulo: "Next\\.js", pacote: "next" },
  { rotulo: "React", pacote: "react" },
  { rotulo: "TypeScript", pacote: "typescript" },
  { rotulo: "Tailwind", pacote: "tailwindcss" },
  { rotulo: "Zod", pacote: "zod" },
  { rotulo: "Vitest", pacote: "vitest" },
  { rotulo: "Playwright", pacote: "@playwright/test" },
  { rotulo: "Sentry", pacote: "@sentry/nextjs" },
];

describe("AGENTS.md mantém package.json como fonte das versões", () => {
  const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<
    string,
    Record<string, string>
  >;

  for (const { rotulo, pacote } of BIBLIOTECAS) {
    it(`não congela a versão de ${pacote} no contrato portátil`, () => {
      const declaradaNoAgents = agents.match(new RegExp(`${rotulo}\\s+v?\\d+(?:\\.\\d+)*`, "i"));
      expect(
        declaradaNoAgents,
        `AGENTS.md voltou a duplicar a versão de ${pacote}; mantenha a versão em package.json`,
      ).toBeNull();

      const existeNoPackage = pkg.dependencies?.[pacote] ?? pkg.devDependencies?.[pacote];
      expect(existeNoPackage, `${pacote} precisa continuar declarado em package.json`).toBeTruthy();
    });
  }
});
