export interface ReleaseGuardResult { result: 'PASS' | 'FAIL'; reason: string }

export function checkProductionReleaseCandidate(input: { porcelain: string }): ReleaseGuardResult {
  return input.porcelain.length === 0
    ? { result: 'PASS', reason: 'working tree is clean' }
    : { result: 'FAIL', reason: 'working tree is dirty; production release requires a clean tree' }
}

export interface NodeContractResult {
  repository_node: string
  current_node: string
  vercel_node: string | null
  result: 'PASS' | 'FAIL' | 'NOT_PROVEN'
  reason: string
}

export function checkNodeContract(input: { expected: string; current: string; vercel?: string | null }): NodeContractResult {
  const vercel = input.vercel ?? null
  if (vercel === null) return { repository_node: input.expected, current_node: input.current, vercel_node: null, result: 'NOT_PROVEN', reason: 'Vercel Node metadata was not provided' }
  const currentMatches = input.current.startsWith(input.expected.replace('.x', '.'))
  const vercelMatches = vercel === input.expected
  return {
    repository_node: input.expected,
    current_node: input.current,
    vercel_node: vercel,
    result: currentMatches && vercelMatches ? 'PASS' : 'FAIL',
    reason: currentMatches && vercelMatches ? 'repository, current process and Vercel Node contracts align' : 'Vercel Node configuration drifts from the repository contract',
  }
}
