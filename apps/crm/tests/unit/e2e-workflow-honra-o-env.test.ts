/**
 * The CI's public-site browser E2E runs without containers or credentials.
 * Authenticated CRM Playwright is a DIFFERENT gate: its config must continue
 * refusing an absent/non-local .env.e2e to prevent writes to production.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "../../../..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/e2e.yml"), "utf8");
const crmConfig = fs.readFileSync(path.join(root, "apps/crm/playwright.config.ts"), "utf8");
const crmEnvGenerator = fs.readFileSync(path.join(root, "apps/crm/scripts/gerar-env-e2e.sh"), "utf8");
const websitePkg = JSON.parse(fs.readFileSync(path.join(root, "apps/website/package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("native E2E boundary", () => {
  it("executes actual public browser specs, not a green placeholder", () => {
    expect(workflow).toMatch(/playwright install --with-deps chromium/);
    expect(workflow).toMatch(/pnpm --dir apps\/website run test:e2e/);
    expect(websitePkg.scripts["test:e2e"]).toMatch(/playwright test/);
    expect(workflow).toMatch(/pnpm install --frozen-lockfile/);
    expect(workflow).toMatch(/pnpm repo:check/);
    expect(workflow).not.toMatch(/continue-on-error:\s*true/);
  });

  it("never starts container services or acquires cloud credentials", () => {
    expect(workflow).not.toMatch(/^\s+services:/m);
    expect(workflow).not.toMatch(/docker(?:\/|\s)|supabase\s+(?:start|db)/i);
    expect(workflow).not.toMatch(/secrets\.|SERVICE_ROLE_KEY\s*:/);
    expect(workflow).toMatch(/NEXT_PUBLIC_SITE_URL: https:\/\/lumenva-ci\.invalid/);
  });

  it("does not misrepresent public smoke coverage as CRM authenticated E2E", () => {
    expect(workflow).toMatch(/NOT authenticated CRM E2E/);
    expect(workflow).not.toMatch(/pnpm --dir apps\/crm run test:e2e/);
    expect(crmConfig).toMatch(/\.env\.e2e/);
    expect(crmConfig).toMatch(/throw new Error/);
    expect(crmConfig).toMatch(/http:\/\/127\.0\.0\.1/);
    expect(crmEnvGenerator).toMatch(/RECUSADO: o stack local respondeu com uma URL que não é local/);
  });
});
