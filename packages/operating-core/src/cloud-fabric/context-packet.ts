export type CanonicalContextLevel = 0 | 1 | 2 | 3 | 4;

export interface CanonicalContextFile {
  path: string;
  symbols: string[];
  score: number;
  excerpt?: string;
}

export interface ContextPacket {
  packet_id: string;
  task_id: string;
  context_version: string;
  level: CanonicalContextLevel;
  objective: string;
  relevant_instructions: string[];
  relevant_files: CanonicalContextFile[];
  relevant_symbols: string[];
  prior_decisions: string[];
  constraints: string[];
  available_tools: string[];
  evidence: string[];
  token_budget: number;
  character_count: number;
  mcp_catalog_version?: string;
}
