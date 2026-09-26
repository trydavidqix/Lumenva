import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('foundation coverage audit', () => {
  it('records that Instagram Standalone is not part of this branch rather than silently claiming coverage', async () => {
    const manifest = JSON.parse(await readFile(new URL('../../../apps/web/package.json', import.meta.url), 'utf8')) as { scripts?: { 'test:foundation'?: string } }
    const foundation = manifest.scripts?.['test:foundation'] ?? ''
    expect(foundation).not.toContain('@lumenva/provider-instagram-standalone')
  })
})
