import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ObsidianExportBlockedError,
  buildExportBasename,
  exportObsidianNote,
} from "../../scripts/obsidian-export";

const VALID_FRONTMATTER = {
  status: "PUBLISHED",
  organization_id: "00000000-0000-4000-8000-000000000001",
  agent_id: "00000000-0000-4000-8000-000000000002",
  title: "Política de Reembolso",
  source_id: "refund-policy",
  version: 3,
  published_at: "2026-08-10T12:00:00Z",
};

function buildNote(
  overrides: Partial<typeof VALID_FRONTMATTER> = {},
  bodyLines: string[] = ["# Política de Reembolso", "", "Reembolsos em até 5 dias úteis."],
): string {
  const fm = { ...VALID_FRONTMATTER, ...overrides };
  const frontmatterBlock = Object.entries(fm)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return `---\n${frontmatterBlock}\n---\n\n${bodyLines.join("\n")}\n`;
}

const workspaces: string[] = [];

function makeWorkspace(): { vaultDir: string; outputDir: string } {
  const root = mkdtempSync(join(tmpdir(), "obsidian-export-test-"));
  workspaces.push(root);
  const vaultDir = join(root, "vault");
  const outputDir = join(root, "out");
  return { vaultDir, outputDir };
}

afterEach(() => {
  while (workspaces.length > 0) {
    const dir = workspaces.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function writeNote(vaultDir: string, filename: string, content: string): string {
  mkdirSync(vaultDir, { recursive: true });
  const filePath = join(vaultDir, filename);
  writeFileSync(filePath, content, "utf8");
  return filePath;
}

describe("buildExportBasename", () => {
  it("is deterministic for the same source_id + version", () => {
    expect(buildExportBasename("refund-policy", 3)).toBe(buildExportBasename("refund-policy", 3));
  });

  it("changes when version changes", () => {
    expect(buildExportBasename("refund-policy", 3)).not.toBe(
      buildExportBasename("refund-policy", 4),
    );
  });

  it("changes when source_id changes", () => {
    expect(buildExportBasename("refund-policy", 3)).not.toBe(
      buildExportBasename("shipping-policy", 3),
    );
  });

  it("slugifies unsafe filesystem characters out of source_id", () => {
    expect(buildExportBasename("Refund Policy / v2!", 1)).toBe("refund-policy-v2-v1");
  });
});

describe("exportObsidianNote", () => {
  it("refuses a DRAFT note", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const filePath = writeNote(vaultDir, "note.md", buildNote({ status: "DRAFT" }));

    expect(() => exportObsidianNote({ filePath, outputDir })).toThrow();
    expect(existsSync(outputDir)).toBe(false);
  });

  it("refuses a REVIEW note", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const filePath = writeNote(vaultDir, "note.md", buildNote({ status: "REVIEW" }));

    expect(() => exportObsidianNote({ filePath, outputDir })).toThrow();
    expect(existsSync(outputDir)).toBe(false);
  });

  it("refuses an ARCHIVED note", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const filePath = writeNote(vaultDir, "note.md", buildNote({ status: "ARCHIVED" }));

    expect(() => exportObsidianNote({ filePath, outputDir })).toThrow();
    expect(existsSync(outputDir)).toBe(false);
  });

  it("exports a PUBLISHED note into a sanitized markdown artifact plus a metadata sidecar", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const filePath = writeNote(vaultDir, "note.md", buildNote());

    const result = exportObsidianNote({ filePath, outputDir });

    expect(existsSync(result.markdownPath)).toBe(true);
    expect(existsSync(result.metadataPath)).toBe(true);

    const exportedMarkdown = readFileSync(result.markdownPath, "utf8");
    expect(exportedMarkdown).not.toContain("status: PUBLISHED");
    expect(exportedMarkdown).not.toContain("organization_id:");
    expect(exportedMarkdown).toContain("Reembolsos em até 5 dias úteis.");

    const metadata = JSON.parse(readFileSync(result.metadataPath, "utf8"));
    expect(metadata).toMatchObject({
      status: "PUBLISHED",
      organization_id: VALID_FRONTMATTER.organization_id,
      agent_id: VALID_FRONTMATTER.agent_id,
      source_id: VALID_FRONTMATTER.source_id,
      version: VALID_FRONTMATTER.version,
    });
  });

  it("blocks export and writes no artifact when the note contains a detectable secret", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const filePath = writeNote(
      vaultDir,
      "note.md",
      buildNote({}, ["# Runbook", "", `AWS_ACCESS_KEY_ID=${["AKIA", "1234567890123456"].join("")}`]),
    );

    expect(() => exportObsidianNote({ filePath, outputDir })).toThrow(ObsidianExportBlockedError);

    try {
      exportObsidianNote({ filePath, outputDir });
    } catch (error) {
      expect(error).toBeInstanceOf(ObsidianExportBlockedError);
      const blocked = error as ObsidianExportBlockedError;
      // Scanned text is `${title}\n${body}`, so body line 3 ("# Runbook",
      // "", "AWS_ACCESS_KEY_ID=...") shifts to line 4 once title occupies line 1.
      expect(blocked.findings).toEqual([{ code: "api_key", line: 4 }]);
    }

    expect(existsSync(outputDir) ? readdirSync(outputDir) : []).toHaveLength(0);
  });

  it("blocks export and writes no artifact when the note's title (not the body) contains a detectable secret", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const filePath = writeNote(vaultDir, "note.md", buildNote({ title: "Bearer abcd1234efgh" }));

    expect(() => exportObsidianNote({ filePath, outputDir })).toThrow(ObsidianExportBlockedError);

    try {
      exportObsidianNote({ filePath, outputDir });
    } catch (error) {
      expect(error).toBeInstanceOf(ObsidianExportBlockedError);
      const blocked = error as ObsidianExportBlockedError;
      expect(blocked.findings).toEqual([{ code: "credential", line: 1 }]);
    }

    expect(existsSync(outputDir) ? readdirSync(outputDir) : []).toHaveLength(0);
  });

  it("produces a deterministic output filename derived from source_id + version", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const filePath = writeNote(vaultDir, "note.md", buildNote());

    const first = exportObsidianNote({ filePath, outputDir });
    const second = exportObsidianNote({ filePath, outputDir });

    expect(first.markdownPath).toBe(second.markdownPath);
    expect(first.metadataPath).toBe(second.metadataPath);
    expect(first.markdownPath).toContain(
      buildExportBasename(VALID_FRONTMATTER.source_id, VALID_FRONTMATTER.version),
    );
  });

  it("produces a different filename for a different version of the same source", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const filePathV3 = writeNote(vaultDir, "note-v3.md", buildNote());
    const filePathV4 = writeNote(vaultDir, "note-v4.md", buildNote({ version: 4 }));

    const v3 = exportObsidianNote({ filePath: filePathV3, outputDir });
    const v4 = exportObsidianNote({ filePath: filePathV4, outputDir });

    expect(v3.markdownPath).not.toBe(v4.markdownPath);
  });

  it("never modifies the source Markdown file", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const original = buildNote();
    const filePath = writeNote(vaultDir, "note.md", original);

    exportObsidianNote({ filePath, outputDir });

    expect(readFileSync(filePath, "utf8")).toBe(original);
  });

  it("never modifies the source Markdown file even when the export is blocked", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    const original = buildNote({}, ["# Runbook", "", "Senha: SuperSecreta123!"]);
    const filePath = writeNote(vaultDir, "note.md", original);

    expect(() => exportObsidianNote({ filePath, outputDir })).toThrow(ObsidianExportBlockedError);
    expect(readFileSync(filePath, "utf8")).toBe(original);
  });

  it("throws a clear error when the source file does not exist", () => {
    const { vaultDir, outputDir } = makeWorkspace();
    expect(() => exportObsidianNote({ filePath: join(vaultDir, "missing.md"), outputDir })).toThrow(
      /not found/i,
    );
  });
});
