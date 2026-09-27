import assert from 'node:assert/strict'
import test from 'node:test'
import * as validationParser from './branch-validation-parser.mjs'
const { extractFailureSignatures, summarizeVitestOutput } = validationParser

test('launches Windows pnpm without enabling implicit shell execution', () => {
  assert.equal(typeof validationParser.spawnSpec, 'function')
  assert.deepEqual(validationParser.spawnSpec(
    'pnpm',
    ['install', '--frozen-lockfile'],
    { platform: 'win32', comSpec: 'C:\\Windows\\System32\\cmd.exe' },
  ), {
    command: 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d', '/s', '/c', 'pnpm.cmd', 'install', '--frozen-lockfile'],
    options: { shell: false, windowsHide: true },
  })
})

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

test('counts actual timeout diagnostics, not test names or runWithTimeout stack frames', () => {
  const output = [
    'FAIL src/adapter.test.ts > StripeAdapter > throws standard error on Stripe timeout or failure',
    'at runWithTimeout (node_modules/@vitest/runner/dist/chunk.js:2272:10)',
    'Error: Test timed out in 5000ms.',
    'Timeout terminating worker after test timeout',
  ].join('\n')

  assert.equal(typeof validationParser.countTimeouts, 'function')
  assert.equal(validationParser.countTimeouts(output), 2)
})

test('aggregates Vitest totals from every recursively executed package', () => {
  const output = [
    'pkg-a test:unit:  Test Files  2 passed (2)',
    'pkg-a test:unit:       Tests  9 passed (9)',
    'pkg-b test:unit:  Test Files  1 failed | 3 passed | 1 skipped (5)',
    'pkg-b test:unit:       Tests  2 failed | 12 passed | 1 skipped (15)',
  ].join('\n')

  assert.deepEqual(summarizeVitestOutput(output), {
    passedTests: 21,
    failedTests: 2,
    skippedTests: 1,
    testFiles: '1 failed | 5 passed | 1 skipped',
    tests: '2 failed | 21 passed | 1 skipped',
    packageSummaries: 2,
  })
})
