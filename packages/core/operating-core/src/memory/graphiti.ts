/**
 * Graphiti Graph Interfaces
 */

import type { MemoryNamespace, ContactNamespace, TenantOrgNamespace } from './memory-kernel.js';

export interface GraphNode {
  id: string;
  namespace: MemoryNamespace;
  label: string;
  properties?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  properties?: Record<string, unknown>;
  createdAt: Date;
}

export interface TimeBasedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timestamp: Date;
}

export interface CustomerGraph extends TimeBasedGraph {
  namespace: ContactNamespace;
}

export interface CompanyGraph extends TimeBasedGraph {
  namespace: TenantOrgNamespace;
}

export interface GraphitiStore {
  addNode(node: Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<GraphNode>;
  addEdge(edge: Omit<GraphEdge, 'id' | 'createdAt'>): Promise<GraphEdge>;
  getNode(id: string): Promise<GraphNode | null>;
  getEdges(nodeId: string, direction?: 'in' | 'out' | 'both'): Promise<GraphEdge[]>;
  getGraphSnapshot(namespace: MemoryNamespace, asOf: Date): Promise<TimeBasedGraph>;
}
