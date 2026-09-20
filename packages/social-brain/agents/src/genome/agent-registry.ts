import { AgentGenome, AgentStatus } from './agent-genome';

/**
 * Agent Registry interface for managing Agent Genomes and their lifecycle
 */
export interface IAgentRegistry {
  /**
   * Register a new agent genome
   */
  register(genome: AgentGenome): Promise<void>;

  /**
   * Load an agent genome by ID
   */
  load(agentId: string): Promise<AgentGenome | null>;

  /**
   * Update an agent genome
   */
  update(agentId: string, updates: Partial<AgentGenome>): Promise<void>;

  /**
   * Update the lifecycle state of an agent
   */
  updateState(agentId: string, status: AgentStatus): Promise<void>;

  /**
   * Get all agents by status
   */
  listByStatus(status: AgentStatus): Promise<AgentGenome[]>;

  /**
   * Remove an agent genome
   */
  deregister(agentId: string): Promise<void>;
}
