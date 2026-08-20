/**
 * Unit tests for lib/lgpd/sla.ts — computeDueAtGdpr
 *
 * Verifies GDPR/RGPD Art. 12(3) calendar-month deadline calculation:
 * no weekend/holiday skipping (unlike the Brazilian computeDueAt), plus
 * correct clamping when the receipt day doesn't exist in the target month.
 */

import { describe, it, expect } from "vitest";
import { computeDueAtGdpr } from "@/lib/lgpd/sla";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("computeDueAtGdpr — GDPR Art. 12(3) calendar-month SLA calculator", () => {
  it("default 1 month: simple mid-month date", () => {
    expect(fmt(computeDueAtGdpr(d("2026-05-10")))).toBe("2026-06-10");
  });

  it("does not skip weekends or holidays", () => {
    // 2026-05-01 is a Friday holiday in Brazil — GDPR calculator must not care
    expect(fmt(computeDueAtGdpr(d("2026-04-01"), 1))).toBe("2026-05-01");
  });

  it("clamps 31 Jan + 1 month to 28 Feb (non-leap year)", () => {
    expect(fmt(computeDueAtGdpr(d("2027-01-31"), 1))).toBe("2027-02-28");
  });

  it("clamps 31 Jan + 1 month to 29 Feb (leap year)", () => {
    expect(fmt(computeDueAtGdpr(d("2028-01-31"), 1))).toBe("2028-02-29");
  });

  it("supports the 2-month extension (complex requests, Art. 12(3) 2nd sentence)", () => {
    expect(fmt(computeDueAtGdpr(d("2026-01-15"), 3))).toBe("2026-04-15");
  });

  it("rolls over year boundary correctly", () => {
    expect(fmt(computeDueAtGdpr(d("2026-12-05"), 1))).toBe("2027-01-05");
  });
});
