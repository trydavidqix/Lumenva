import { AgentGenome, AgentStatus } from '../genome/agent-genome';

const createPilotAgent = (id: string, name: string, role: string): AgentGenome => ({
  agent_id: id,
  identity: {
    name,
    role,
  },
  management: {},
  core: {
    system_prompt: `You are ${name}, the ${role}.`,
    instructions: [],
  },
  behavior: {
    proactivity_level: 'MEDIUM',
    communication_style: 'professional',
  },
  psyche: {
    traits: [],
    motivations: [],
  },
  memory: {
    retention_policy: 'standard',
    context_window_size: 100000,
  },
  knowledge: {
    sources: [],
    domains: [],
  },
  skills: [],
  tools: [],
  permissions: [],
  models: {
    primary: 'default-model',
  },
  kpis: {
    targets: {},
  },
  budget: {},
  shift: {},
  eval_suite: {
    metrics: [],
    thresholds: {},
  },
  status: 'OFFLINE' as AgentStatus, // Stubbed status, marking implementation
});

export const claudeMaestro = createPilotAgent('claude-maestro', 'Claude Maestro', 'Maestro');
export const codexBuilder = createPilotAgent('codex-builder', 'Codex Builder', 'Builder');
export const geminiSpecialist = createPilotAgent('gemini-specialist', 'Gemini Specialist', 'Specialist');
export const independentReviewer = createPilotAgent('independent-reviewer', 'Independent Reviewer', 'Reviewer');
export const manager = createPilotAgent('manager', 'Manager', 'Manager');
export const sales = createPilotAgent('sales', 'Sales', 'Sales Representative');
export const support = createPilotAgent('support', 'Support', 'Support Agent');
export const research = createPilotAgent('research', 'Research', 'Researcher');
export const opsWatcher = createPilotAgent('ops-watcher', 'Ops Watcher', 'Ops Watcher');
export const notificationRouter = createPilotAgent('notification-router', 'Notification Router', 'Router');
export const hermes = createPilotAgent('hermes', 'Hermes', 'Messenger');

export const pilotRoster: AgentGenome[] = [
  claudeMaestro,
  codexBuilder,
  geminiSpecialist,
  independentReviewer,
  manager,
  sales,
  support,
  research,
  opsWatcher,
  notificationRouter,
  hermes,
];
