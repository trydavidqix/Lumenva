import { describe, expect, it } from "vitest";
import { getHolidaysPt } from "@/lib/lgpd/holidays-pt";

describe("Portuguese mandatory national holidays", () => {
  it("contains movable and fixed 2026 holidays", () => {
    expect(getHolidaysPt(2026)).toEqual(expect.arrayContaining([
      "2026-04-03", "2026-04-05", "2026-06-04", "2026-04-25", "2026-06-10", "2026-12-01",
    ]));
  });
});
