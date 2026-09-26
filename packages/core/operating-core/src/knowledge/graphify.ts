export type CodeNodeType = "file" | "function" | "class" | "config" | "module" | "unknown";
export type CodeEdgeType = "imports" | "calls" | "depends_on" | "implements" | "contains";

export interface CodeNode {
  id: string;
  type: CodeNodeType;
  name: string;
  filePath: string;
  contentSnippet?: string;
  metadata?: Record<string, unknown>;
}

export interface CodeEdge {
  sourceId: string;
  targetId: string;
  type: CodeEdgeType;
  weight?: number;
}

export interface Subgraph {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

export interface Task {
  id: string;
  description: string;
  files?: string[];
  metadata?: Record<string, unknown>;
}

export class GraphifyEngine {
  constructor(private readonly rootDir: string) {}

  /**
   * Generates a focused subgraph based on the provided task.
   * This avoids dumping the whole repository into context.
   * 
   * @param task The task for which to generate the subgraph
   * @returns A focused Subgraph
   */
  public extractSubgraphForTask(task: Task): Subgraph {
    // Stub implementation for now
    return {
      nodes: [],
      edges: []
    };
  }
}
