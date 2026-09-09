/**
 * Obsidian → CRM knowledge export CLI.
 *
 * The Obsidian vault is a human authoring workspace outside the CRM
 * runtime (Phase 3 constraint: "Do not store the Obsidian vault in the CRM
 * database"). This script is the only bridge between a note edited in
 * Obsidian and the CRM's knowledge UI upload path: it reads one Markdown
 * file, refuses anything that is not editorially `PUBLISHED` (Task 1's
 * `assertPublishableDocument`), blocks anything that still looks like a
 * secret or undisclosed PII (Task 2's `scanPublishableKnowledge`), and only
 * then writes a sanitized artifact a human operator uploads by hand. It
 * never talks to Postgres/Supabase directly and never writes back to the
 * source note.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPublishableDocument,
  type PublicationFrontmatter,
} from "../lib/ai/rag/publication/frontmatter";
import {
  scanPublishableKnowledge,
  type KnowledgeScanFinding,
} from "../lib/ai/rag/publication/sanitize";

export const DEFAULT_OUTPUT_DIR = resolve(process.cwd(), ".local/knowledge-publish");

/** Thrown when the scanner finds a secret/PII shape; findings carry only code+line, never the matched value. */
export class ObsidianExportBlockedError extends Error {
  readonly findings: KnowledgeScanFinding[];

  constructor(findings: KnowledgeScanFinding[]) {
    const summary = findings.map((finding) => `${finding.code}@line ${finding.line}`).join(", ");
    super(`Export blocked by ${findings.length} secret/PII finding(s): ${summary}`);
    this.name = "ObsidianExportBlockedError";
    this.findings = findings;
  }
}

interface ParsedObsidianNote {
  frontmatterRaw: Record<string, unknown>;
  body: string;
}

/**
 * Flat `key: value` frontmatter reader — deliberately not a generic YAML
 * parser. The publication contract (Task 1) only ever has scalar fields
 * (status/organization_id/agent_id/title/source_id/version/published_at),
 * so a hand-rolled reader keeps the parsing surface small for an untrusted
 * vault file, matching the house style already used for skill packages
 * (`lib/ai/skills/package.ts`) and FAQ ingestion (`lib/ai/rag/ingest/faq.ts`).
 * Type coercion (integer strings → number) is intentionally minimal — the
 * real validation is `assertPublishableDocument`'s Zod schema, not this
 * reader.
 */
function parseObsidianNote(source: string): ParsedObsidianNote {
  const normalized = source.replace(/\r\n/g, "\n").trimStart();
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!match) {
    throw new Error('Obsidian note is missing a YAML frontmatter block delimited by "---".');
  }
  const [, frontmatterBlock, bodyRaw] = match;
  const frontmatterRaw: Record<string, unknown> = {};

  for (const line of (frontmatterBlock ?? "").split("\n")) {
    if (line.trim() === "") continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatterRaw[key] = /^-?\d+$/.test(value) ? Number(value) : value;
  }

  return { frontmatterRaw, body: (bodyRaw ?? "").trim() };
}

/**
 * Deterministic, filesystem-safe basename for the exported artifact pair.
 * The same `source_id` + `version` always resolves to the same files, so
 * re-running the export after fixing a finding overwrites instead of
 * accumulating stale artifacts in `.local/knowledge-publish/`.
 */
export function buildExportBasename(sourceId: string, version: number): string {
  const slug = sourceId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "untitled"}-v${version}`;
}

export interface ObsidianExportOptions {
  filePath: string;
  outputDir?: string;
}

export interface ObsidianExportResult {
  markdownPath: string;
  metadataPath: string;
  frontmatter: PublicationFrontmatter;
}

/**
 * Reads a single Obsidian note and, only when it is editorially PUBLISHED
 * and clean of detectable secrets/PII, writes a sanitized Markdown body
 * plus a canonical metadata sidecar JSON into the output directory.
 *
 * The secret/PII scan runs on `title` + body, not the raw frontmatter
 * block: `organization_id`/`agent_id`/`source_id`/`version`/`published_at`
 * are UUID/slug/int/ISO-datetime-shaped and already validated by
 * `assertPublishableDocument`'s strict Zod schema, so they cannot smuggle
 * freeform secret text through this path — feeding them to the scanner
 * anyway is actively harmful: UUID v4's hyphen-grouped digit runs collide
 * with `scanPublishableKnowledge`'s phone heuristic (verified directly —
 * every valid, schema-conformant frontmatter block gets `organization_id`/
 * `agent_id` flagged `personal_phone`), which would make every valid
 * PUBLISHED note unexportable. `title`, however, is `z.string().trim().min(1)`
 * with no shape constraint — the one frontmatter field besides body that can
 * carry arbitrary pasted text — so it is scanned alongside body rather than
 * excluded with the rest of the workflow metadata. A secret pasted into
 * `title` must block the export exactly like one pasted into the body; it
 * would otherwise reach the metadata sidecar undetected.
 *
 * The source file is opened read-only and is never written to.
 */
export function exportObsidianNote(options: ObsidianExportOptions): ObsidianExportResult {
  const sourcePath = resolve(options.filePath);
  if (!existsSync(sourcePath)) {
    throw new Error(`Obsidian note not found: ${sourcePath}`);
  }

  const raw = readFileSync(sourcePath, "utf8");
  const { frontmatterRaw, body } = parseObsidianNote(raw);
  const frontmatter = assertPublishableDocument(frontmatterRaw);

  const scan = scanPublishableKnowledge(`${frontmatter.title}\n${body}`);
  if (!scan.allowed) {
    throw new ObsidianExportBlockedError(scan.findings);
  }

  const outputDir = resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  mkdirSync(outputDir, { recursive: true });

  const basename = buildExportBasename(frontmatter.source_id, frontmatter.version);
  const markdownPath = resolve(outputDir, `${basename}.md`);
  const metadataPath = resolve(outputDir, `${basename}.meta.json`);

  writeFileSync(markdownPath, `${body}\n`, "utf8");
  writeFileSync(metadataPath, `${JSON.stringify(frontmatter, null, 2)}\n`, "utf8");

  return { markdownPath, metadataPath, frontmatter };
}

export function parseFileArg(argv: string[]): string {
  const flagIndex = argv.indexOf("--file");
  const value = flagIndex === -1 ? undefined : argv[flagIndex + 1];
  if (!value) {
    throw new Error(
      "Usage: pnpm knowledge:obsidian:export -- --file <absolute-or-vault-relative-path>",
    );
  }
  return value;
}

function main(): void {
  let filePath: string;
  try {
    filePath = parseFileArg(process.argv.slice(2));
  } catch (error) {
    console.error(`[obsidian-export] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  try {
    const result = exportObsidianNote({ filePath });
    process.stdout.write(
      `${JSON.stringify({
        status: "exported",
        markdown: result.markdownPath,
        metadata: result.metadataPath,
        source_id: result.frontmatter.source_id,
        version: result.frontmatter.version,
      })}\n`,
    );
  } catch (error) {
    console.error(`[obsidian-export] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
