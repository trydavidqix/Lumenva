import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const planPath = resolve(root, 'docs/architecture/F8-GCP-ONLY-TARGET-MATRIX.md')

function readPlan() {
  assert.ok(existsSync(planPath), `missing F8 design contract: ${planPath}`)
  return readFileSync(planPath, 'utf8')
}

test('F8 contract defines GCP-only targets without data or auth cutover', () => {
  const plan = readPlan()

  for (const target of [
    'environment',
    'service account',
    'IAM',
    'Secret Manager',
    'Artifact Registry',
    'Cloud Logging',
    'Scheduler',
    'Cloud Tasks',
    'rollback',
  ]) {
    assert.match(plan, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }

  assert.match(plan, /sem (?:dado|dados|auth)|without (?:data|auth)|não toca.*RLS|nao toca.*RLS/i)
  assert.match(plan, /credential value|valor de credencial|sem valores? de credencial/i)
})

test('F8 contract applies least privilege, observability, and owner-last gates', () => {
  const plan = readPlan()

  for (const rule of [
    '.claude/rules/security.md',
    '.claude/rules/audit-observability.md',
    '.claude/rules/testing-verification.md',
  ]) {
    assert.match(plan, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  for (const required of ['least privilege', 'retention', 'dry-run', 'Owner', 'F8-C1', 'F8-H1']) {
    assert.match(plan, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }
})
