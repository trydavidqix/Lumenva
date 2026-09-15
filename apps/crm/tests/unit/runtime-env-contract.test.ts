import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("contrato de ambiente de runtime", () => {
  it("valida e documenta a flag pública de archive", () => {
    expect(read("lib/env.ts")).toMatch(/CONVERSATION_ARCHIVE_V1:\s*z\.\s*\n?\s*\.enum\(\[\"true\", \"false\"\]\)/);
    expect(read(".env.example")).toContain("CONVERSATION_ARCHIVE_V1=false");
  });

  it("expõe somente o valor já validado pelo schema", () => {
    const script = read("apps/crm/app/public-env-script.tsx");

    expect(script).toContain("CONVERSATION_ARCHIVE_V1: env.CONVERSATION_ARCHIVE_V1");
    expect(script).not.toContain("process.env.CONVERSATION_ARCHIVE_V1");
  });
});
