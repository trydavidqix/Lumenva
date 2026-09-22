import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsePublishedMarkdown, type KnowledgeProvenance } from "./publication.js";
import { scanKnowledgeBody } from "./sanitizer.js";

export type PublishedArtifact = {
  path: string;
  provenance: KnowledgeProvenance;
};

export function exportPublishedNote(input: {
  markdown: string;
  sourcePath: string;
  outputDir: string;
}): PublishedArtifact {
  const note = parsePublishedMarkdown(input.markdown, input.sourcePath);
  scanKnowledgeBody(note.body);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(note.sourceId)) {
    throw new Error("invalid knowledge note: source_id must be filename-safe");
  }
  mkdirSync(input.outputDir, { recursive: true });
  const path = join(input.outputDir, `${note.sourceId}.v${note.version}.md`);
  writeFileSync(path, input.markdown, "utf8");
  return { path, provenance: note.provenance };
}
