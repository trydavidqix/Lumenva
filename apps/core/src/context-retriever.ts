import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { parsePublishedMarkdown, scanKnowledgeBody } from "@lumenva/knowledge";
import type { GraphFact, KnowledgeGraph } from "@lumenva/knowledge-graph";
import type { ContextCandidate, ProgressiveContextRetriever, TaskContract } from "./context-engine.js";

type RetrieverTask = Pick<TaskContract, "goal" | "allowedPaths">;

export type KnowledgeContextRetrieverConfig = {
  root: string;
  knowledgePath: string;
  graph?: Pick<KnowledgeGraph, "search">;
  namespace?: string;
  graphLimit?: number;
};

export class KnowledgeContextRetriever implements ProgressiveContextRetriever {
  constructor(private readonly config: KnowledgeContextRetrieverConfig) {}

  async symbols(task: RetrieverTask): Promise<ContextCandidate[]> {
    const notes = await this.readPublishedNotes(task);
    const graphFacts = this.config.graph && this.config.namespace
      ? await this.config.graph.search({ namespace: this.config.namespace, query: task.goal, limit: this.config.graphLimit ?? 10 })
      : [];
    return [...notes, ...graphFacts.map(toCandidate)].sort(compareCandidates);
  }

  async excerpts(_task: RetrieverTask, candidates: ContextCandidate[]): Promise<ContextCandidate[]> {
    return candidates.map(candidate => ({ ...candidate, content: candidate.content }));
  }

  private async readPublishedNotes(task: RetrieverTask): Promise<ContextCandidate[]> {
    const knowledgeRoot = join(this.config.root, this.config.knowledgePath);
    const files = await markdownFiles(knowledgeRoot);
    const candidates: ContextCandidate[] = [];
    for (const file of files) {
      const path = relative(this.config.root, file).split(sep).join("/");
      if (!isAllowedPath(path, task.allowedPaths)) continue;
      try {
        const markdown = await readFile(file, "utf8");
        const note = parsePublishedMarkdown(markdown, path);
        scanKnowledgeBody(note.body);
        candidates.push({ path, symbols: [note.title, note.sourceId], content: note.body, score: relevance(task.goal, note.title, note.body) });
      } catch {
        // Draft, malformed, or unsafe notes stay out of the context packet.
      }
    }
    return candidates;
  }
}

async function markdownFiles(root: string): Promise<string[]> {
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return []; }
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(path);
  }
  return files;
}

function toCandidate(fact: GraphFact): ContextCandidate {
  return { path: `graph:${fact.id}`, symbols: [fact.sourceId], content: fact.text, score: fact.confidence };
}

function relevance(query: string, title: string, body: string): number {
  const terms = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const haystack = `${title} ${body}`.toLowerCase();
  return [...terms].reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function compareCandidates(left: ContextCandidate, right: ContextCandidate): number {
  return right.score - left.score || left.path.localeCompare(right.path);
}

function isAllowedPath(path: string, allowedPaths: string[]): boolean {
  return allowedPaths.some(allowed => path === allowed || path.startsWith(`${allowed}/`));
}
