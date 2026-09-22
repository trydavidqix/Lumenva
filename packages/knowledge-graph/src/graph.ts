export type GraphFact = {
  id: string;
  text: string;
  sourceId: string;
  confidence: number;
  validFrom: string | null;
  validUntil: string | null;
};

export type KnowledgeGraph = {
  addEpisode(input: GraphEpisode): Promise<void>;
  search(input: { namespace: string; query: string; limit: number }): Promise<GraphFact[]>;
  health(): Promise<{ ok: boolean; latencyMs: number }>;
};

export type GraphEpisode = {
  namespace: string;
  sourceId: string;
  sourceVersion: string;
  title: string;
  body: string;
  referenceTime: string;
  provenance: { sourcePath: string; sourceType: "obsidian" };
  idempotencyKey: string;
};

export function createProjectNamespace(projectName: string): string {
  const slug = projectName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("project name must contain letters or numbers");
  return `project:${slug}`;
}

export class NullKnowledgeGraph implements KnowledgeGraph {
  async addEpisode(_input: GraphEpisode): Promise<void> {}

  async search(_input: { namespace: string; query: string; limit: number }): Promise<GraphFact[]> {
    return [];
  }

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: false, latencyMs: 0 };
  }
}
