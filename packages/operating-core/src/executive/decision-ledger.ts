import { RiskLevel } from '../autonomy/risk-level.js';

export interface ExecutiveDecision {
  id: string;
  executive: string;
  problem: string;
  risk: RiskLevel;
  models_used: string[];
  proposals: string[];
  disagreements: string[];
  decision: string;
  reasoning_summary: string;
  evidence: string[];
  cost: number;
}
