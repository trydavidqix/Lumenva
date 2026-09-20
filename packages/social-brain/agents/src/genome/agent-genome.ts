/**
 * Agent Genome definition for the Canonical Blueprint
 */

export interface AgentGenome {
  agent_id: string;
  identity: AgentIdentity;
  management: AgentManagement;
  core: AgentCore;
  behavior: AgentBehavior;
  psyche: AgentPsyche;
  memory: AgentMemory;
  knowledge: AgentKnowledge;
  skills: string[]; // List of skill IDs
  tools: string[]; // List of tool IDs
  permissions: string[];
  models: AgentModels;
  kpis: AgentKPIs;
  budget: AgentBudget;
  shift: AgentShift;
  eval_suite: AgentEvalSuite;
  status: AgentStatus;
}

export interface AgentIdentity {
  name: string;
  role: string;
  avatar_url?: string;
  description?: string;
}

export interface AgentManagement {
  manager_id?: string;
  department?: string;
  tags?: string[];
}

export interface AgentCore {
  system_prompt: string;
  instructions: string[];
}

export interface AgentBehavior {
  proactivity_level: 'LOW' | 'MEDIUM' | 'HIGH';
  communication_style: string;
}

export interface AgentPsyche {
  traits: string[];
  motivations: string[];
}

export interface AgentMemory {
  retention_policy: string;
  context_window_size: number;
}

export interface AgentKnowledge {
  sources: string[]; // e.g., vector db collection ids
  domains: string[];
}

export interface AgentModels {
  primary: string;
  fallback?: string;
  temperature?: number;
}

export interface AgentKPIs {
  targets: Record<string, string | number>;
}

export interface AgentBudget {
  daily_token_limit?: number;
  monthly_cost_limit?: number;
}

export interface AgentShift {
  working_hours?: string;
  timezone?: string;
}

export interface AgentEvalSuite {
  metrics: string[];
  thresholds: Record<string, number>;
}

export type AgentStatus = 'WORKING' | 'WAITING' | 'BLOCKED' | 'SLEEPING' | 'OFFLINE' | 'TERMINATED';
