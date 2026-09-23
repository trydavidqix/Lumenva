import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const planPath = resolve(root, 'docs/architecture/F6-DRIZZLE-DOMAIN-PLAN.md')

function readPlan() {
  assert.ok(existsSync(planPath), `missing F6 design contract: ${planPath}`)
  return readFileSync(planPath, 'utf8')
}

test('F6 contract defines domain rollout, shadow reads, mismatch policy, and rollback', () => {
  const plan = readPlan()

  for (const required of [
    '# F6',
    'CRM/Leads',
    'Conversations/Messages/Media',
    'shadow read',
    'mismatch',
    'rollback',
    'promoção',
    'SET LOCAL app.organization_id',
    'off',
    'observe',
    'sampled',
    'enforced',
  ]) {
    assert.match(plan, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }
})

test('F6 contract preserves tenant, RBAC, migration, and evidence boundaries', () => {
  const plan = readPlan()

  for (const rule of [
    '.claude/rules/database-migrations.md',
    '.claude/rules/multi-tenancy.md',
    '.claude/rules/data-modeling.md',
    '.claude/rules/security.md',
    '.claude/rules/api-contract.md',
    '.claude/rules/audit-observability.md',
    '.claude/rules/testing-verification.md',
  ]) {
    assert.match(plan, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(plan, /migration.*baseline\.sql.*MANIFEST|baseline\.sql.*MANIFEST.*migration/is)
  assert.match(plan, /no (?:production )?migration|sem migration|não .*migration/i)
  assert.match(plan, /Codex-only|Codex only/i)
  assert.match(plan, /F6-C1/i)
  assert.match(plan, /F6-H1/i)
})
