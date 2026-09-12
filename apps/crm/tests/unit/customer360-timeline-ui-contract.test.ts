import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Customer 360 timeline surface contract", () => {
  it("loads contact timeline pages with cursor and type filters", () => {
    const source = read("apps/crm/hooks/contacts/useTimeline.ts");
    expect(source).toMatch(/useInfiniteQuery/);
    expect(source).toMatch(/cursor/);
    expect(source).toMatch(/type/);
  });

  it("renders loading, error retry, empty and pagination states", () => {
    const source = read("apps/crm/components/contacts/TimelineView.tsx");
    expect(source).toMatch(/q\.isLoading/);
    expect(source).toMatch(/q\.refetch/);
    expect(source).toMatch(/Nenhuma atividade registrada/);
    expect(source).toMatch(/q\.fetchNextPage/);
  });

  it("mounts timeline inside contact detail", () => {
    const source = read("apps/crm/app/app/contacts/[id]/_client.tsx");
    expect(source).toMatch(/<TimelineView contactId=\{contactId\}/);
  });
});
