import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Merge Queue realtime contract", () => {
  it("subscritos postgres_changes em merge_queue e invalida apenas a query da fila", () => {
    const source = read("apps/crm/hooks/contacts/useMergeQueue.ts");
    expect(source).toContain('table: "merge_queue"');
    expect(source).toContain('event: "*"');
    expect(source).toContain("useRealtimeChannel");
    expect(source).toContain("invalidateQueries({ queryKey: mergeQueueQueryKey })");
  });

  it("desativa query e canal para utilizadores sem permissão", () => {
    const source = read("apps/crm/hooks/contacts/useMergeQueue.ts");
    expect(source).toContain("const enabled = options.enabled ?? true");
    expect(source).toContain("enabled,");
    expect(source).toContain("postgresChanges: enabled");
  });
});
