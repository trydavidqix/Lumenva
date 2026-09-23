import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const workflowPath = resolve(root, '.github/workflows/gcp-ci.yml')

function readWorkflow() {
  assert.ok(existsSync(workflowPath), `missing GCP CI workflow: ${workflowPath}`)
  return readFileSync(workflowPath, 'utf8')
}

test('GCP CI workflow exists and uses correct Node/pnpm versions', () => {
  const workflow = readWorkflow()
  assert.match(workflow, /node-version: ['"]?22['"]?/, 'Must use Node 22')
  assert.match(workflow, /version: ['"]?9\.15\.9['"]?/, 'Must use pnpm 9.15.9')
  assert.match(workflow, /pnpm install --frozen-lockfile/, 'Must use frozen-lockfile for install')
})

test('GCP CI workflow includes necessary testing gates', () => {
  const workflow = readWorkflow()
  assert.match(workflow, /pnpm test:unit/, 'Must include test:unit gate')
  assert.match(workflow, /pnpm test:db/, 'Must include test:db gate')
})

test('GCP CI workflow includes GCP dry-run capabilities without real deployment', () => {
  const workflow = readWorkflow()

  // Must use OIDC or fake credentials
  assert.match(workflow, /auth|google-github-actions\/auth/i, 'Must include GCP auth step')
  assert.match(workflow, /workload_identity_provider/i, 'Must use Workload Identity Federation')

  // No secrets allowed
  assert.doesNotMatch(workflow, /secrets\.GCP_CREDENTIALS/i, 'Must not use raw JSON credential secrets')

  // Must explicitly state dry-run or not push
  assert.match(workflow, /dry-run|push:\s*false/i, 'Must not perform actual deployments/pushes')
})
