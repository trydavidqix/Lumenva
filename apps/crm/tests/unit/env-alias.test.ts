import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

// Resolve from this test file, not process.cwd(). Docker/build runners may
// invoke Vitest from a different working directory.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const helper = resolve(repoRoot, "hostgator-setup-kit/_env-alias.sh");

function run(env: Record<string, string | undefined>) {
  const script = 'set -e; source "$1"; env_alias "$2"; printf \'%s\' "${LUMENVA_AGENT_REPORT-}"';
  const childEnv = Object.fromEntries(Object.entries({ ...process.env, LUMENVA_AGENT_REPORT: undefined, DESKCOMM_AGENT_REPORT: undefined, ...env }).filter(([, value]) => value !== undefined)) as NodeJS.ProcessEnv;
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolveResult) => {
    execFile("bash", ["-e", "-c", script, "env-alias-test", helper, "AGENT_REPORT"], { env: childEnv, encoding: "utf8" }, (error, stdout, stderr) => {
      resolveResult({ status: error ? (typeof error.code === "number" ? error.code : error.status ?? 1) : 0, stdout, stderr });
    });
  });
}

describe("prefixo de ambiente LUMENVA com fallback DESKCOMM", () => {
  it("usa apenas LUMENVA", async () => {
    const result = await run({ LUMENVA_AGENT_REPORT: "novo" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("novo");
    expect(result.stderr).toBe("");
  });

  it("usa DESKCOMM como fallback e avisa sem valor", async () => {
    const result = await run({ DESKCOMM_AGENT_REPORT: "legado" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("legado");
    expect(result.stderr).toContain("DESKCOMM_AGENT_REPORT");
    expect(result.stderr).toContain("LUMENVA_AGENT_REPORT");
    expect(result.stderr).not.toContain("DESKCOMM_AGENT_REPORT=legado");
  });

  it("aceita ambos quando iguais", async () => {
    const result = await run({ LUMENVA_AGENT_REPORT: "igual", DESKCOMM_AGENT_REPORT: "igual" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("igual");
  });

  it("rejeita ambos quando diferentes, sem imprimir valores", async () => {
    const result = await run({ LUMENVA_AGENT_REPORT: "novo", DESKCOMM_AGENT_REPORT: "legado" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("valores diferentes");
    expect(result.stderr).not.toContain("novo");
    expect(result.stderr).not.toContain("legado");
  });

  it("mantém ausência como variável não definida", async () => {
    const result = await run({});
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("é um helper versionado e legível pelo kit", () => {
    expect(readFileSync(helper, "utf8")).toContain("env_alias()");
  });
});
