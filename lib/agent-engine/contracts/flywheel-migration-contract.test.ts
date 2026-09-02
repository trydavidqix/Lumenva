import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260818140000_0138_agent_os_phase6_flywheel_proposal_types.sql',
);

const sql = readFileSync(migrationPath, 'utf8');

const legacyTypes = ['playbook_bullet', 'golden_case', 'reentry_trigger', 'org_memory_entry'] as const;
const phase6Types = ['skill_change', 'routing_change', 'eval_case', 'operational_threshold'] as const;

describe('Phase 6 flywheel proposal-type migration contract', () => {
  it('targets only the legacy flywheel proposal type constraint', () => {
    expect(sql).toContain('alter table flywheel_distiller_proposals');
    expect(sql).toContain('drop constraint if exists flywheel_distiller_proposals_type_check');
    expect(sql).toContain('add constraint flywheel_distiller_proposals_type_check');
    expect(sql).not.toMatch(/alter table\s+(?!flywheel_distiller_proposals\b)[a-z0-9_]+/i);
  });

  it('preserves every legacy proposal type', () => {
    for (const type of legacyTypes) expect(sql).toContain(`'${type}'`);
  });

  it('admits exactly the closed Phase 6 proposal allowlist additions', () => {
    for (const type of phase6Types) expect(sql).toContain(`'${type}'`);
    expect(sql).not.toContain("'source_code_change'");
    expect(sql).not.toContain("'autonomy_increase'");
    expect(sql).not.toContain("'security_change'");
  });

  it('does not contain remote/apply commands or destructive table drops', () => {
    expect(sql).not.toMatch(/\bdrop\s+table\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
  });
});
