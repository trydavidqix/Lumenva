import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE = join(process.cwd(), "app/api/v1/creator-commerce/actions/route.ts");
const source = () => readFileSync(ROUTE, "utf8");

describe("Creator Commerce governed action route", () => {
  it("derives tenant from auth and never accepts organization identity in the body", () => {
    const text = source();
    expect(text).toContain('requireRole("manager"');
    expect(text).toContain("authz.org.orgId");
    expect(text).not.toMatch(/organization(Id|_id)\s*:\s*z\./);
    expect(text).toContain('.eq("organization_id", organizationId)');
  });

  it("uses idempotency and never executes sensitive commercial publication directly", () => {
    const text = source();
    expect(text).toContain("Idempotency-Key");
    expect(text).toContain('"commerce.approval_requested"');
    expect(text).not.toContain("provider.publish(");
    expect(text).not.toContain("publication.execute_external");
  });

  it("queues sync/reconciliation as durable events rather than doing provider work in request lifecycle", () => {
    const text = source();
    expect(text).toContain('"commerce.provider_sync_requested"');
    expect(text).toContain('"commerce.reconciliation_requested"');
  });
});
