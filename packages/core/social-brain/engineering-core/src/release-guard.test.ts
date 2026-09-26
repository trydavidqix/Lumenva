import { describe, expect, it } from 'vitest'
import { checkProductionReleaseCandidate, checkNodeContract } from './release-guard.ts'

describe('production release guards', () => {
  it('fails closed when the working tree is dirty', () => {
    expect(checkProductionReleaseCandidate({ porcelain: ' M README.md' })).toEqual({
      result: 'FAIL', reason: 'working tree is dirty; production release requires a clean tree',
    })
    expect(checkProductionReleaseCandidate({ porcelain: '' })).toEqual({ result: 'PASS', reason: 'working tree is clean' })
  })

  it('detects repository/Vercel Node drift without changing either environment', () => {
    expect(checkNodeContract({ expected: '22.x', current: '22.23.2', vercel: '24.x' })).toEqual({
      repository_node: '22.x', current_node: '22.23.2', vercel_node: '24.x', result: 'FAIL', reason: 'Vercel Node configuration drifts from the repository contract',
    })
    expect(checkNodeContract({ expected: '22.x', current: '22.23.2', vercel: '22.x' }).result).toBe('PASS')
  })
})
