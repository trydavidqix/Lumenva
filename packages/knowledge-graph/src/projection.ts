import type { GraphEpisode, KnowledgeGraph } from "./graph.js";

export type PublishedNoteForProjection = {
  namespace: string;
  title: string;
  sourceId: string;
  version: number;
  publishedAt: string;
  body: string;
  provenance: { sourceType: "obsidian"; sourcePath: string; sourceId: string; version: number };
};

export async function projectPublishedNote(
  graph: Pick<KnowledgeGraph, "addEpisode">,
  note: PublishedNoteForProjection,
): Promise<string> {
  const idempotencyKey = `${note.namespace}:${note.sourceId}:v${note.version}`;
  const episode: GraphEpisode = {
    namespace: note.namespace,
    sourceId: note.sourceId,
    sourceVersion: String(note.version),
    title: note.title,
    body: note.body,
    referenceTime: note.publishedAt,
    provenance: { sourcePath: note.provenance.sourcePath, sourceType: note.provenance.sourceType },
    idempotencyKey,
  };
  await graph.addEpisode(episode);
  return idempotencyKey;
}
