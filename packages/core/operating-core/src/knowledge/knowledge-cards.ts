export interface KnowledgeCard {
  id: string;
  title: string;
  source_id: string;
  summary: string;
  critical_facts: string[];
  limitations: string[];
  examples: string[];
  created_at: string;
  updated_at: string;
}
