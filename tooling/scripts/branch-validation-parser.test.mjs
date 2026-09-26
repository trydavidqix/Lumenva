import assert from 'node:assert/strict'
import test from 'node:test'
import { extractFailureSignatures } from './branch-validation-parser.mjs'

test('extracts stable unit failure IDs after pnpm prefixes', () => {
  const log = 'apps/crm test:unit:  FAIL  tests/unit/auth.test.ts > rejects invalid user\n'

  assert.deepEqual(extractFailureSignatures(log, 'unit'), [
    'tests/unit/auth.test.ts > rejects invalid user',
  ])
})

test('extracts failed-suite and failed-test identifiers without ANSI or checkout paths', () => {
  const log = [
    '\u001b[31mapps/crm test:unit:  FAIL  tests/unit/setup.test.mjs [ tests/unit/setup.test.mjs ]\u001b[0m',
    'apps/crm test:unit:  FAIL  tests/unit/auth.test.ts > rejects invalid user',
    'apps/crm test:unit:  FAIL  tests/unit/other.test.ts > accepts valid user',
  ].join('\n')

  assert.deepEqual(extractFailureSignatures(log, 'unit'), [
    'tests/unit/auth.test.ts > rejects invalid user',
    'tests/unit/other.test.ts > accepts valid user',
    'tests/unit/setup.test.mjs',
  ])
})

test('extracts build diagnostics after package prefixes and normalizes runner paths', () => {
  const log = [
    'apps/crm build: Error: ENOENT: no such file, open D:\\a\\Lumenva\\main-validation\\apps\\crm\\supabase',
    ' ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @lumenva/mcp@ build: `next build`',
  ].join('\n')

  assert.deepEqual(extractFailureSignatures(log, 'build'), [
    'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @lumenva/mcp@ build: `next build`',
    'Error: ENOENT: no such file, open <CHECKOUT>\\apps\\crm\\supabase',
  ])
})

test('does not treat unrelated unit output as a failure signature', () => {
  assert.deepEqual(extractFailureSignatures('apps/crm test:unit: passed 42 tests', 'unit'), [])
})
