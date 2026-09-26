import { AgentDefinition } from '../types';

/**
 * Evaluates an agent definition against basic structural criteria.
 * Once these pass and specific capability tests pass, an agent can be moved to 'ACTIVE'.
 */
export function validateAgentStructure(agent: AgentDefinition): boolean {
  console.log(`Running evals for ${agent.role}...`);
  
  if (agent.systemPrompt.length < 50) {
    console.error(`[FAIL] ${agent.role}: System prompt too short or missing.`);
    return false;
  }
  
  if (!agent.capabilities || agent.capabilities.length === 0) {
    console.error(`[FAIL] ${agent.role}: No capabilities defined.`);
    return false;
  }

  // Placeholder for LLM-based behavioral evaluation
  console.log(`[PASS] ${agent.role} passed baseline structural evals.`);
  return true;
}

export function evaluateAgentTransitionToActive(agent: AgentDefinition): boolean {
  const passesStructure = validateAgentStructure(agent);
  
  // Here we would add more rigorous tests for:
  // - System prompt adherence (using LLM as a judge)
  // - Tool calling accuracy
  // - Output formatting
  
  return passesStructure;
}
