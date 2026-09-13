import { describe, expect, it } from "vitest";

import { registerSource, createPostgresSourceRegistry, type SourceRecord } from "./source-registry";

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
    expect(result.record).toMatchObject({ sourceId: "source:org-a:https://docs.example.com/hermes/semantic-memory:2026.09", owner: "memory-team", license: "CC-BY-4.0", version: "2026.09", createdAt: "2026-09-12T12:00:00.000Z" });
  });

  it("é idempotente para a mesma organização, URI e versão", () => {
    const existing: SourceRecord = { ...source, sourceId: "source:org-a:https://docs.example.com/hermes/semantic-memory:2026.09", createdAt: "2026-09-12T11:00:00.000Z" };
    expect(registerSource(source, [existing], "2026-09-12T12:00:00.000Z")).toEqual({ created: false, record: existing });
  });

  it("falha fechado quando owner, licença, versão ou URI faltam", () => {
    expect(() => registerSource({ ...source, owner: "" }, [])).toThrow("source_registry_invalid");
    expect(() => registerSource({ ...source, license: " " }, [])).toThrow("source_registry_invalid");
    expect(() => registerSource({ ...source, version: "" }, [])).toThrow("source_registry_invalid");
    expect(() => registerSource({ ...source, uri: "not-a-uri" }, [])).toThrow("source_registry_invalid");
  });

  it("persiste, reconstrói e serializa concorrência no Postgres", async () => {
    const url = process.env.SOURCE_REGISTRY_DATABASE_URL;
    if (!url) return;
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    await pool.query(`CREATE TABLE IF NOT EXISTS hermes_source_registry_test (
      organization_id text NOT NULL, source_id text NOT NULL, uri text NOT NULL, title text NOT NULL,
      owner text NOT NULL, license text NOT NULL, version text NOT NULL, source_type text NOT NULL,
      scope text, retrieved_at timestamptz, last_verified_at timestamptz, content_hash text, state text NOT NULL,
      created_at timestamptz NOT NULL, PRIMARY KEY (organization_id, source_id)
    )`);
    await pool.query("TRUNCATE hermes_source_registry_test");
    const db = { query: (text: string, values?: unknown[]) => pool.query(text, values) };
    const a = createPostgresSourceRegistry(db, "hermes_source_registry_test");
    const b = createPostgresSourceRegistry(db, "hermes_source_registry_test");
    const [first, second] = await Promise.all([a.register(source, "2026-09-12T12:00:00.000Z"), b.register(source, "2026-09-12T12:00:01.000Z")]);
    expect(first.record).toEqual(second.record);
    const rebuilt = await a.list("org-a");
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0]).toMatchObject({ organizationId: "org-a", uri: source.uri, state: "active" });
    await pool.end();
  });
});
