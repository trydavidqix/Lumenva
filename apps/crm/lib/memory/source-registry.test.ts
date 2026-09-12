import { describe, expect, it } from "vitest";

import { registerSource, type SourceRecord } from "./source-registry";

const source: Omit<SourceRecord, "sourceId" | "createdAt"> = {
  organizationId: "org-a",
  uri: "https://docs.example.com/hermes/semantic-memory",
  title: "Hermes Semantic Memory",
  owner: "memory-team",
  license: "CC-BY-4.0",
  version: "2026.09",
  sourceType: "approved_internal",
};

describe("Hermes Source Registry", () => {
  it("registra owner, licença e versão de uma fonte semântica", () => {
    const result = registerSource(source, [], "2026-09-12T12:00:00.000Z");

    expect(result.created).toBe(true);
    expect(result.record).toMatchObject({
      sourceId: "source:org-a:https://docs.example.com/hermes/semantic-memory:2026.09",
      owner: "memory-team",
      license: "CC-BY-4.0",
      version: "2026.09",
      createdAt: "2026-09-12T12:00:00.000Z",
    });
  });

  it("é idempotente para a mesma organização, URI e versão", () => {
    const existing: SourceRecord = {
      ...source,
      sourceId: "source:org-a:https://docs.example.com/hermes/semantic-memory:2026.09",
      createdAt: "2026-09-12T11:00:00.000Z",
    };

    const result = registerSource(source, [existing], "2026-09-12T12:00:00.000Z");

    expect(result).toEqual({ created: false, record: existing });
  });

  it("falha fechado quando owner, licença, versão ou URI faltam", () => {
    expect(() => registerSource({ ...source, owner: "" }, [])).toThrow("source_registry_invalid");
    expect(() => registerSource({ ...source, license: " " }, [])).toThrow("source_registry_invalid");
    expect(() => registerSource({ ...source, version: "" }, [])).toThrow("source_registry_invalid");
    expect(() => registerSource({ ...source, uri: "not-a-uri" }, [])).toThrow("source_registry_invalid");
  });
});
