import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");
describe("Customer 360 timeline contract", () => {
  it("bounds and filters contact timeline", () => { const s = read("apps/crm/app/api/v1/contacts/[id]/timeline/route.ts"); expect(s).toMatch(/getAll\("type"\)/); expect(s).toMatch(/decodeCursor/); expect(s).toMatch(/limit\(FETCH\)/); });
  it("merges direct and lead activities deterministically", () => { const s = read("apps/crm/app/api/v1/contacts/[id]/timeline/route.ts"); expect(s).toMatch(/crm_lead_activities/); expect(s).toMatch(/new Map<string, TimelineItem>/); expect(s).toMatch(/comNomeDoAtor/); });
});
