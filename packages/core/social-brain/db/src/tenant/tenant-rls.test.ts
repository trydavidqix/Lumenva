import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '../../../..')
const migration = resolve(root, 'infra/supabase/migrations/20260922120000_0200_f2_tenant_isolation.sql')
const baseline = resolve(root, 'infra/supabase/baseline.sql')
const manifest = resolve(root, 'infra/supabase/migrations/MANIFEST.md')

describe('F2 tenant RLS contract', () => {
  it('keeps migration, baseline and manifest aligned', () => {
    const sql = readFileSync(migration, 'utf8')
    expect(sql).toMatch(/app_runtime/)
    expect(sql).toMatch(/worker_runtime/)
    expect(sql).toMatch(/migration_admin/)
    expect(sql).toMatch(/platform_admin_runtime/)
    expect(sql).toMatch(/NO BYPASSRLS|NOBYPASSRLS/i)
    expect(sql).toMatch(/current_setting\('app\.organization_id', true\)/i)
    expect(sql).toMatch(/FOR SELECT/i)
    expect(sql).toMatch(/FOR INSERT/i)
    expect(sql).toMatch(/FOR UPDATE/i)
    expect(sql).toMatch(/FOR DELETE/i)
    expect(readFileSync(baseline, 'utf8')).toMatch(/0200_f2_tenant_isolation/)
    expect(readFileSync(manifest, 'utf8')).toMatch(/20260922120000.*0200_f2_tenant_isolation/)
    expect(readFileSync(resolve(root, 'packages/core/social-brain/db/src/tenant/tenant-query.ts'), 'utf8')).toMatch(/set_config\([^;]+true\)/i)
  })
})
