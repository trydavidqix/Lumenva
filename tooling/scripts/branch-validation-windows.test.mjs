import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ensureCrmSupabaseLink } from './branch-validation-windows.mjs'

test('creates and reuses the CRM Supabase compatibility junction in a Windows checkout', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lumenva-ci-link-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const target = join(root, 'infra', 'supabase')
  mkdirSync(target, { recursive: true })
  mkdirSync(join(root, 'apps', 'crm'), { recursive: true })

  assert.equal(ensureCrmSupabaseLink(root), 'created')
  assert.equal(statSync(join(root, 'apps', 'crm', 'supabase')).isDirectory(), true)
  assert.equal(
    realpathSync(join(root, 'apps', 'crm', 'supabase')),
    realpathSync(target),
  )
  assert.equal(ensureCrmSupabaseLink(root), 'existing')
})

test('does not overwrite a conflicting CRM Supabase path', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lumenva-ci-link-conflict-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'infra', 'supabase'), { recursive: true })
  mkdirSync(join(root, 'apps', 'crm'), { recursive: true })
  const path = join(root, 'apps', 'crm', 'supabase')
  writeFileSync(path, 'preserve this conflicting file')

  assert.throws(() => ensureCrmSupabaseLink(root), /not a directory link/)
  assert.equal(readFileSync(path, 'utf8'), 'preserve this conflicting file')
})

test('repairs a Windows checkout placeholder for the tracked Supabase symlink', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lumenva-ci-link-placeholder-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const target = join(root, 'infra', 'supabase')
  mkdirSync(target, { recursive: true })
  mkdirSync(join(root, 'apps', 'crm'), { recursive: true })
  const path = join(root, 'apps', 'crm', 'supabase')
  writeFileSync(path, '../../infra/supabase')

  assert.equal(ensureCrmSupabaseLink(root), 'repaired')
  assert.equal(realpathSync(path), realpathSync(target))
})

test('does not create a CRM link when the canonical Supabase directory is missing', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lumenva-ci-link-missing-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'apps', 'crm'), { recursive: true })

  assert.throws(() => ensureCrmSupabaseLink(root), /canonical Supabase directory is missing/)
})
