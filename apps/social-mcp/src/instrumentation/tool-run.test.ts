import { describe, expect, it, vi } from 'vitest'

import { redactSecrets, runInstrumentedTool } from './tool-run'

function context(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'workspace-1',
    ownerUserId: 'owner-1',
    audit: {
      startAgentRun: vi.fn(async () => ({ id: 'run-1' })),
      finishAgentRun: vi.fn(async () => undefined),
      appendEvent: vi.fn(async () => ({ id: 'event-1' })),
    },
    ...overrides,
  }
}

describe('MCP audit instrumentation', () => {
  it('redacts secret-like keys recursively', () => {
    const result = redactSecrets({
      authorization: 'Bearer abc',
      nested: { apiToken: 'hidden', safe: 'visible' },
      password: 'never-store',
    })
    expect(result).toEqual({
      authorization: '[REDACTED]',
      nested: { apiToken: '[REDACTED]', safe: 'visible' },
      password: '[REDACTED]',
    })
  })

  it('returns a successful mutation result even if post-handler audit finalization fails', async () => {
    const ctx = context({
      audit: {
        startAgentRun: vi.fn(async () => ({ id: 'run-1' })),
        finishAgentRun: vi.fn(async () => { throw new Error('audit unavailable') }),
        appendEvent: vi.fn(async () => { throw new Error('audit unavailable') }),
      },
    })
    const handler = vi.fn(async () => ({ id: 'created-1' }))

    await expect(runInstrumentedTool(ctx as never, 'social.content.create_plan', {}, handler))
      .resolves.toEqual({ id: 'created-1' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('preserves the original tool error when failure audit persistence also fails', async () => {
    const ctx = context({
      audit: {
        startAgentRun: vi.fn(async () => ({ id: 'run-1' })),
        finishAgentRun: vi.fn(async () => { throw new Error('audit unavailable') }),
        appendEvent: vi.fn(async () => { throw new Error('audit unavailable') }),
      },
    })
    const original = Object.assign(new Error('approval stale'), { code: 'approval_stale' })

    await expect(runInstrumentedTool(ctx as never, 'social.publish.now', {}, async () => { throw original }))
      .rejects.toBe(original)
  })
})
