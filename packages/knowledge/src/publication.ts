export type KnowledgeProvenance = {
  sourceType: "obsidian";
  sourcePath: string;
  sourceId: string;
  version: number;
};

export type PublishedKnowledge = {
  title: string;
  sourceId: string;
  version: number;
  publishedAt: string;
  body: string;
  provenance: KnowledgeProvenance;
};

const ALLOWED_FIELDS = new Set(["status", "title", "source_id", "version", "published_at"]);

function invalid(message: string): never {
  throw new Error(`invalid knowledge note: ${message}`);
}

function parseFrontmatter(markdown: string): { values: Record<string, string>; body: string } {
  if (!markdown.startsWith("---\n")) invalid("frontmatter is required");
  const closing = markdown.indexOf("\n---", 4);
  if (closing < 0) invalid("frontmatter must be closed");

  const header = markdown.slice(4, closing);
  const values: Record<string, string> = {};
  for (const line of header.split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) invalid(`malformed frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!ALLOWED_FIELDS.has(key)) invalid(`unknown field: ${key}`);
    if (!value) invalid(`empty field: ${key}`);
    if (key in values) invalid(`duplicate field: ${key}`);
    values[key] = value;
  }

  const bodyStart = closing + "\n---".length;
  return { values, body: markdown.slice(bodyStart).replace(/^\n/, "").trim() };
}

function required(values: Record<string, string>, key: string): string {
  const value = values[key];
  if (!value) invalid(`missing field: ${key}`);
  return value;
}

export function parsePublishedMarkdown(markdown: string, sourcePath: string): PublishedKnowledge {
  if (!sourcePath.trim()) invalid("source path is required");
  const { values, body } = parseFrontmatter(markdown);
  if (required(values, "status") !== "PUBLISHED") {
    throw new Error("only PUBLISHED notes can enter the knowledge pipeline");
  }

  const title = required(values, "title");
  const sourceId = required(values, "source_id");
  const versionText = required(values, "version");
  if (!/^\d+$/.test(versionText) || Number(versionText) < 1) invalid("version must be a positive integer");
  const version = Number(versionText);
  const publishedAt = required(values, "published_at");
  const parsedDate = new Date(publishedAt);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString() !== publishedAt) {
    invalid("published_at must be an ISO timestamp");
  }
  if (!body) invalid("body is required");

  return {
    title,
    sourceId,
    version,
    publishedAt,
    body,
    provenance: { sourceType: "obsidian", sourcePath, sourceId, version },
  };
}
