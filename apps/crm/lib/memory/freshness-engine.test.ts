import { describe, expect, it } from "vitest";
import { evaluateRegisteredSourceFreshness, evaluateSourceFreshness, type FreshnessOptions } from "./freshness-engine";
import type { SourceRecord } from "./source-registry";
const source = (overrides: Partial<SourceRecord> = {}): SourceRecord => ({ sourceId: "source:org-a:docs:1", organizationId: "org-a", uri: "https://docs.example.com/hermes", title: "Hermes", owner: "memory-team", license: "CC-BY-4.0", version: "1.0", sourceType: "approved_internal", createdAt: "2026-09-10T12:00:00.000Z", ...overrides });
const options: FreshnessOptions = { now: "2026-09-12T12:00:00.000Z", maxAgeMs: 2 * 24 * 60 * 60 * 1000 };
describe("Freshness Engine do Hermes Source Registry", () => {
  it("marca fonte dentro da janela como fresh", () => { expect(evaluateSourceFreshness([source()], options)[0]).toMatchObject({ freshness: "fresh" }); });
  it("marca fonte além da janela como stale", () => { expect(evaluateSourceFreshness([source({ createdAt: "2026-09-01T12:00:00.000Z" })], options)[0]).toMatchObject({ freshness: "stale" }); });
  it("falha fechado para timestamp futuro ou inválido", () => { expect(evaluateSourceFreshness([source({ sourceId: "future", createdAt: "2026-09-13T00:00:00.000Z" }), source({ sourceId: "invalid", createdAt: "not-a-date" })], options).map((item) => item.freshness)).toEqual(["stale", "stale"]); });
  it("não muta o registry de entrada", () => { const input = [source()]; evaluateSourceFreshness(input, options); expect(input[0]?.freshness).toBeUndefined(); });
  it("integra leitura persistida do registry no pipeline de freshness", async () => { const calls: string[] = []; const result = await evaluateRegisteredSourceFreshness({ list: async (organizationId) => { calls.push(organizationId); return [source()]; } }, "org-a", options); expect(calls).toEqual(["org-a"]); expect(result[0]).toMatchObject({ freshness: "fresh" }); });
});
