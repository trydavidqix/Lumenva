import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const consentSql = readFileSync(
  new URL("../../../../supabase/migrations/20260913110000_contact_consents.sql", import.meta.url),
  "utf8",
);
const integrationSql = readFileSync(
  new URL("../../../../supabase/migrations/20260913040000_0167_wave11_replay_secret_proxy.sql", import.meta.url),
  "utf8",
);

describe("Wave 11 schema contract", () => {
  it("uses the canonical organization UUID foreign key for durable Wave 11 tables", () => {
    expect(consentSql).toMatch(
      /organization_id\s+uuid\s+not\s+null\s+references\s+public\.organizations\(id\)\s+on\s+delete\s+cascade/i,
    );
    expect(integrationSql).toMatch(
      /integration_webhook_receipts\s*\([^;]*organization_id\s+uuid\s+not\s+null\s+references\s+public\.organizations\(id\)\s+on\s+delete\s+cascade/is,
    );
    expect(integrationSql).toMatch(
      /integration_secrets\s*\([^;]*organization_id\s+uuid\s+not\s+null\s+references\s+public\.organizations\(id\)\s+on\s+delete\s+cascade/is,
    );
  });

  it("keeps integration secret values server-only", () => {
    expect(integrationSql).not.toMatch(
      /grant\s+select\s+on\s+public\.integration_secrets\s+to\s+authenticated/i,
    );
    expect(integrationSql).toMatch(
      /revoke\s+all\s+on\s+public\.integration_secrets\s+from\s+authenticated/i,
    );
    expect(integrationSql).toMatch(
      /grant\s+select\s*,\s*insert\s*,\s*update\s*,\s*delete\s+on\s+public\.integration_secrets\s+to\s+service_role/i,
    );
  });

  it("persists a retry-safe replay lifecycle and keeps writes trusted", () => {
    expect(integrationSql).toMatch(/status\s+text\s+not\s+null\s+default\s+'PROCESSED'/i);
    expect(integrationSql).toMatch(/status\s+in\s*\(\s*'PROCESSING'\s*,\s*'PROCESSED'\s*,\s*'FAILED'\s*\)/i);
    expect(integrationSql).toMatch(/claim_token\s+uuid/i);
    expect(integrationSql).toMatch(/claimed_at\s+timestamptz/i);
    expect(integrationSql).toMatch(/completed_at\s+timestamptz/i);
    expect(integrationSql).toMatch(/revoke\s+all\s+on\s+public\.integration_webhook_receipts\s+from\s+authenticated/i);
    expect(integrationSql).toMatch(/grant\s+select\s+on\s+public\.integration_webhook_receipts\s+to\s+authenticated/i);
    expect(integrationSql).toMatch(/grant\s+select\s*,\s*insert\s*,\s*update\s*,\s*delete\s+on\s+public\.integration_webhook_receipts\s+to\s+service_role/i);
  });
});
