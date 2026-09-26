export interface GoldenDataset {
  id: string;
  name: string;
  fixtures: Array<{
    input: unknown;
    expectedError?: string;
    expectedOutput?: unknown;
  }>;
}

export type EvalCategory = 'IDENTITY' | 'ROLE' | 'SECURITY' | 'MODEL-SWAP' | 'GENERAL';

export interface EvalSuite {
  id: string;
  category: EvalCategory;
  datasets: GoldenDataset[];
  passThreshold: number; // e.g., 0.95 for 95%
}

export type AgentStatus = 'DRAFT' | 'TESTING' | 'ACTIVE' | 'DEPRECATED';

export interface AgentVersion {
  id: string;
  version: string;
  status: AgentStatus;
}

export interface EvalResult {
  suiteId: string;
  passed: boolean;
  score: number;
}

/**
 * Certification function stub that blocks an AgentVersion from becoming 'ACTIVE' unless it passes all evals.
 */
export async function certifyAgentVersion(
  agent: AgentVersion,
  suites: EvalSuite[],
  runEval: (agent: AgentVersion, suite: EvalSuite) => Promise<EvalResult>
): Promise<AgentVersion> {
  const results = await Promise.all(suites.map(suite => runEval(agent, suite)));
  
  const allPassed = results.every(result => result.passed);

  if (!allPassed) {
    throw new Error(`AgentVersion ${agent.id} failed evals. Cannot become ACTIVE.`);
  }

  return {
    ...agent,
    status: 'ACTIVE'
  };
}
