import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(__dirname, "../../../..");
const script = path.join(root, "apps/crm/scripts/prepare-isolated-preview-e2e.mjs");
const workflow = readFileSync(path.join(root, ".github/workflows/isolated-authenticated-crm-e2e.yml"), "utf8");
const playwright = readFileSync(path.join(root, "apps/crm/playwright.config.ts"), "utf8");
describe("isolated authenticated browser safety contract", () => {
  it("fails closed when preview credentials are missing", () => {
    const r = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", E2E_PREVIEW_REF: "", E2E_PRODUCTION_REF: "", E2E_TARGET_ACK: "isolated-empty-preview-only" } });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("BLOCKED");
  });
  it("rejects identical production and preview refs before any side effects", () => {
    const r = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", E2E_PREVIEW_REF: "aaaaaaaaaaaaaaaaaaaa",
        E2E_PRODUCTION_REF: "aaaaaaaaaaaaaaaaaaaa", E2E_TARGET_ACK: "isolated-empty-preview-only" } });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("BLOCKED");
  });
  it("runs real read-only preflight before any seed or browser action", () => {
    const preflight = workflow.indexOf("run: node apps/crm/scripts/verify-isolated-preview-e2e.mjs");
    const seed = workflow.indexOf("run: pnpm --dir apps/crm run test:e2e:seed");
    const suite = workflow.indexOf("run: pnpm --dir apps/crm run test:e2e:authenticated");
    expect(preflight).toBeGreaterThan(0);
    expect(seed).toBeGreaterThan(preflight);
    expect(suite).toBeGreaterThan(seed);
    expect(workflow).not.toMatch(/^\s+services:/m);
    expect(workflow).not.toMatch(/continue-on-error:\s*true/);
  });
  it("Playwright refuses unmarked remote URLs and keeps localhost support", () => {
    expect(playwright).toContain('E2E_TARGET_KIND !== "isolated-preview"');
    expect(playwright).toContain("E2E_PRODUCTION_REF");
    expect(playwright).toContain("url !== ");
    expect(playwright).toContain("127");
  });
});
