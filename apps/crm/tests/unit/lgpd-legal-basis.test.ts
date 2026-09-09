import { describe, expect, it } from "vitest";
import { canContactForPurpose, LEGAL_BASIS_V1, revokePurpose, type LegalBasisRecord } from "@/lib/lgpd/legal-basis";

const record = (purpose: LegalBasisRecord["purpose"], granted = true): LegalBasisRecord => ({
  purpose, legal_basis: "consent", recorded_at: "2026-01-01T00:00:00Z", evidence: granted ? { granted_at: "2026-01-01T00:00:00Z" } : {},
});

describe("RGPD J4 legal basis", () => {
  it("keeps the rollout flag OFF by default", () => expect(LEGAL_BASIS_V1).toBe(false));
  it("requires explicit evidence and supports easy withdrawal", () => {
    expect(canContactForPurpose([record("marketing", false)], "marketing")).toBe(false);
    expect(canContactForPurpose([record("marketing")], "marketing")).toBe(true);
  });
  it("keeps purposes granular and STOP revokes marketing only", () => {
    const out = revokePurpose([record("marketing"), record("transactional")], "marketing", "2026-02-01T00:00:00Z");
    expect(out[0]?.revoked_at).toBe("2026-02-01T00:00:00Z");
    expect(out[1]?.revoked_at).toBeUndefined();
  });
  it("does not mutate the immutable proof record", () => {
    const source = record("marketing");
    const out = revokePurpose([source], "marketing", "2026-02-01T00:00:00Z");
    expect(source.revoked_at).toBeUndefined();
    expect(out[0]?.evidence).toEqual(source.evidence);
  });
});
