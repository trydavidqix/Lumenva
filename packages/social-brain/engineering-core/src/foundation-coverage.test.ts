import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../')

describe('foundation coverage audit', () => {
  it('records that Instagram Standalone is not part of this branch rather than silently claiming coverage', async () => {
    const manifest = JSON.parse(await readFile(join(repositoryRoot, 'apps/social-brain-web/package.json'), 'utf8')) as { scripts?: { 'test:foundation'?: string } }
    const foundation = manifest.scripts?.['test:foundation'] ?? ''
    expect(foundation).not.toContain('@lumenva/provider-instagram-standalone')
  })
})
