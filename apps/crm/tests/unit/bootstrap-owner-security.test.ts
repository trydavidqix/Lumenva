import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'apps/crm/scripts/bootstrap-owner.ts'), 'utf8')

describe('bootstrap owner output redaction', () => {
  it('does not print owner email, organization identifiers, or raw errors', () => {
    expect(source).not.toMatch(/console\.log\([^\n]*(?:OWNER_EMAIL|orgId|existing as)/)
    expect(source).not.toMatch(/console\.error\([^\n]*err\b/)
  })
})
