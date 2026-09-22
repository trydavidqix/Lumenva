import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePublishedMarkdown } from "./publication.js";
import { scanKnowledgeBody } from "./sanitizer.js";
import { exportPublishedNote } from "./exporter.js";

describe("parsePublishedMarkdown", () => {
  it("accepts a published standalone knowledge note and preserves provenance", () => {
    const result = parsePublishedMarkdown(
      [
        "---",
        "status: PUBLISHED",
        "title: Lumenva Doctrine",
        "source_id: doctrine-1",
        "version: 2",
        "published_at: 2026-09-22T10:00:00.000Z",
        "---",
        "",
        "Use bounded context.",
        "",
      ].join("\n"),
      "Lumenva-Knowledge/00-Canon/CONSTITUTION.md",
    );

    expect(result).toEqual({
      title: "Lumenva Doctrine",
      sourceId: "doctrine-1",
      version: 2,
      publishedAt: "2026-09-22T10:00:00.000Z",
      body: "Use bounded context.",
      provenance: {
        sourceType: "obsidian",
        sourcePath: "Lumenva-Knowledge/00-Canon/CONSTITUTION.md",
        sourceId: "doctrine-1",
        version: 2,
      },
    });
  });

  it("rejects draft notes before they can enter the standalone knowledge pipeline", () => {
    expect(() =>
      parsePublishedMarkdown(
        "---\nstatus: DRAFT\ntitle: Draft\nsource_id: draft-1\nversion: 1\npublished_at: 2026-09-22T10:00:00.000Z\n---\nDraft body",
        "draft.md",
      ),
    ).toThrow("only PUBLISHED notes can enter the knowledge pipeline");
  });

  it("rejects a published note containing a secret-like value", () => {
    expect(() =>
      scanKnowledgeBody("Use token sk-test-12345678901234567890 for local access."),
    ).toThrow("secret-like value detected");
  });

  it("returns clean content when no secret-like value is present", () => {
    expect(scanKnowledgeBody("Use the bounded context guide.")).toEqual({ clean: true, findings: [] });
  });

  it("writes a local artifact without contacting a runtime service", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "lumenva-knowledge-"));
    const artifact = exportPublishedNote({
      markdown: "---\nstatus: PUBLISHED\ntitle: Guide\nsource_id: guide-1\nversion: 1\npublished_at: 2026-09-22T10:00:00.000Z\n---\nGuide body",
      sourcePath: "vault/Guide.md",
      outputDir,
    });

    expect(artifact.path).toBe(join(outputDir, "guide-1.v1.md"));
    expect(readFileSync(artifact.path, "utf8")).toContain("Guide body");
    expect(artifact.provenance.sourceType).toBe("obsidian");
  });
});
