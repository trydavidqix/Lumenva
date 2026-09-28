import { access } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { withTempDir } from './test-temp.ts'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('withTempDir', () => {
  it('removes the temporary directory after a successful callback', async () => {
    let root = ''
    await withTempDir('lumenva-temp-helper-', async (createdRoot) => {
      root = createdRoot
      expect(await exists(root)).toBe(true)
    })
    expect(await exists(root)).toBe(false)
  })

  it('removes the temporary directory when the callback throws', async () => {
    let root = ''
    await expect(withTempDir('lumenva-temp-helper-', async (createdRoot) => {
      root = createdRoot
      throw new Error('boom')
    })).rejects.toThrow('boom')
    expect(await exists(root)).toBe(false)
  })
})
