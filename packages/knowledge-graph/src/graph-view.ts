import type { GraphFact, KnowledgeGraph } from "./graph.js";

export type GraphViewNode = {
  id: string;
  kind: "fact" | "source";
  label: string;
  sourceId?: string;
};

export type GraphViewEdge = {
  id: string;
  source: string;
  target: string;
  sourceId: string;
  confidence: number;
  validFrom: string | null;
  validUntil: string | null;
};

export type GraphView = {
  readOnly: true;
  namespace: string;
  query: string;
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
};

export async function buildGraphView(graph: Pick<KnowledgeGraph, "search">, input: { namespace: string; query: string; limit: number }): Promise<GraphView> {
  const facts = (await graph.search(input)).slice().sort((left, right) => left.id.localeCompare(right.id));
  const nodes: GraphViewNode[] = [];
  const edges: GraphViewEdge[] = [];
  const sources = new Set<string>();

  for (const fact of facts) {
    const factNodeId = `fact:${fact.id}`;
    const sourceNodeId = `source:${fact.sourceId}`;
    nodes.push({ id: factNodeId, kind: "fact", label: fact.text, sourceId: fact.sourceId });
    if (!sources.has(fact.sourceId)) {
      sources.add(fact.sourceId);
      nodes.push({ id: sourceNodeId, kind: "source", label: fact.sourceId });
    }
    edges.push({
      id: `edge:${fact.id}:${fact.sourceId}`,
      source: factNodeId,
      target: sourceNodeId,
      sourceId: fact.sourceId,
      confidence: fact.confidence,
      validFrom: fact.validFrom,
      validUntil: fact.validUntil,
    });
  }

  return { readOnly: true, namespace: input.namespace, query: input.query, nodes, edges };
}
