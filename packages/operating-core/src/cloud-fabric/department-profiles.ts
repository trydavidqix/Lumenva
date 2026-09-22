export interface DepartmentAgentProfile {
  id: string;
  department: string;
  role: string;
  planner_capabilities: string[];
  executor_capabilities: string[];
  verifier_capabilities: string[];
  preferred_planner_providers: string[];
  preferred_executor_models: string[];
  preferred_verifier_providers: string[];
}

export const DEPARTMENT_AGENT_PROFILES: DepartmentAgentProfile[] = [
  {
    id: 'executive-strategy',
    department: 'Executive',
    role: 'Strategy & Architecture',
    planner_capabilities: ['planning', 'strategy', 'architecture'],
    executor_capabilities: ['research'],
    verifier_capabilities: ['review'],
    preferred_planner_providers: ['claude', 'codex', 'antigravity'],
    preferred_executor_models: ['deepseek-worker'],
    preferred_verifier_providers: ['codex', 'antigravity'],
  },
  {
    id: 'engineering',
    department: 'Engineering',
    role: 'Software Factory',
    planner_capabilities: ['architecture', 'coding'],
    executor_capabilities: ['coding'],
    verifier_capabilities: ['review', 'browser'],
    preferred_planner_providers: ['claude', 'codex'],
    preferred_executor_models: ['codex-terra', 'deepseek-worker', 'minimax-worker'],
    preferred_verifier_providers: ['antigravity', 'claude'],
  },
  {
    id: 'research',
    department: 'Research',
    role: 'Research & Intelligence',
    planner_capabilities: ['planning', 'research'],
    executor_capabilities: ['research', 'classification'],
    verifier_capabilities: ['review'],
    preferred_planner_providers: ['antigravity', 'claude'],
    preferred_executor_models: ['deepseek-worker', 'qwen-worker'],
    preferred_verifier_providers: ['claude', 'codex'],
  },
  {
    id: 'marketing',
    department: 'Marketing',
    role: 'Content & Campaigns',
    planner_capabilities: ['strategy', 'planning'],
    executor_capabilities: ['research', 'documents'],
    verifier_capabilities: ['review'],
    preferred_planner_providers: ['claude', 'antigravity'],
    preferred_executor_models: ['minimax-worker', 'deepseek-worker'],
    preferred_verifier_providers: ['claude'],
  },
  {
    id: 'customer-ops',
    department: 'Customer Operations',
    role: 'Customer Operations',
    planner_capabilities: ['planning'],
    executor_capabilities: ['classification', 'documents'],
    verifier_capabilities: ['review'],
    preferred_planner_providers: ['claude'],
    preferred_executor_models: ['deepseek-worker', 'minimax-worker'],
    preferred_verifier_providers: ['antigravity'],
  },
  {
    id: 'design-frontend',
    department: 'Design',
    role: 'Design & Frontend',
    planner_capabilities: ['planning', 'vision'],
    executor_capabilities: ['frontend', 'coding', 'vision'],
    verifier_capabilities: ['browser', 'review'],
    preferred_planner_providers: ['antigravity', 'claude'],
    preferred_executor_models: ['kimi-worker', 'codex-terra'],
    preferred_verifier_providers: ['antigravity'],
  },
  {
    id: 'backoffice',
    department: 'Backoffice',
    role: 'Operations',
    planner_capabilities: ['planning'],
    executor_capabilities: ['documents', 'backoffice', 'classification'],
    verifier_capabilities: ['review'],
    preferred_planner_providers: ['claude'],
    preferred_executor_models: ['minimax-worker', 'deepseek-worker'],
    preferred_verifier_providers: ['codex'],
  },
  {
    id: 'security',
    department: 'Security',
    role: 'Security & Assurance',
    planner_capabilities: ['architecture', 'review'],
    executor_capabilities: ['coding'],
    verifier_capabilities: ['review'],
    preferred_planner_providers: ['claude', 'codex'],
    preferred_executor_models: ['codex-sol'],
    preferred_verifier_providers: ['antigravity', 'claude'],
  },
];
