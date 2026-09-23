import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const planPath = resolve(root, 'docs/architecture/F7-ADAPTER-BOUNDARIES.md')

function readPlan() {
  assert.ok(existsSync(planPath), `missing F7 design contract: ${planPath}`)
  return readFileSync(planPath, 'utf8')
}

test('F7 contract inventories every non-migratable provider and Memorystore decision', () => {
  const plan = readPlan()

  for (const provider of ['Stripe', 'WAHA', 'Meta/Instagram', 'Nuvemshop', 'Resend', 'Sentry']) {
    assert.match(plan, new RegExp(provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }

  for (const concern of [
    'boundary',
    'payload',
    'credencial',
    'sandbox',
    'retry',
    'idempotency',
    'PII',
    'egress',
    'fallback',
    'feature flag',
    'Upstash',
    'Memorystore',
  ]) {
    assert.match(plan, new RegExp(concern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }
})

test('F7 contract forbids secret/provider replacement work and sequences owner actions last', () => {
  const plan = readPlan()

  for (const rule of [
    '.claude/rules/security.md',
    '.claude/rules/api-contract.md',
    '.claude/rules/audit-observability.md',
    '.claude/rules/testing-verification.md',
  ]) {
    assert.match(plan, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(plan, /não migrável|nao migravel|não substitu|nao substitu/i)
  assert.match(plan, /sandbox|fake|stub|placeholder/i)
  assert.match(plan, /Owner.*(último|ultimo)|(último|ultimo).*Owner/is)
  assert.match(plan, /F7-C1/i)
  assert.match(plan, /F7-H1/i)
})
