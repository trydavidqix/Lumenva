import { describe, expect, it } from 'vitest'

import { assertVideoGenerationReady } from './video'

describe('MCP video generation guard', () => {
  it('rejects an incomplete content plan before enqueue', () => {
    expect(() => assertVideoGenerationReady({
      objective: 'Launch',
      topic: 'Social Brain',
      hook: '',
      script: 'Complete script',
      videoBrief: {
        format: '9:16',
        durationTargetSeconds: 30,
        visualDirection: 'Product demo',
      },
    })).toThrow('Content plan is incomplete for video generation')
  })

  it('accepts a complete content plan', () => {
    expect(() => assertVideoGenerationReady({
      objective: 'Launch',
      topic: 'Social Brain',
      hook: 'One workflow, four networks',
      script: 'Complete script',
      videoBrief: {
        format: '9:16',
        durationTargetSeconds: 30,
        visualDirection: 'Product demo',
      },
    })).not.toThrow()
  })
})
