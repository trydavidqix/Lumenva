import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260913130000_0163_hermes_learning_os.sql',
);

function migrationSql(): string {
  return readFileSync(migrationPath, 'utf8');
}

const TABLES = [
  'hermes_research_experiments',
  'hermes_outcomes',
  'hermes_capability_identities',
] as const;

const PROPOSAL_TYPES = [
  'playbook_bullet',
  'golden_case',
  'reentry_trigger',
  'org_memory_entry',
  'skill_change',
  'routing_change',
  'eval_case',
  'operational_threshold',
  'prompt_change',
  'workflow_change',
  'agent_definition_change',
  'model_policy_change',
  'resource_route_change',
  'memory_policy_change',
  'context_policy_change',
  'infra_change',
  'strategy_change',
] as const;

describe('Hermes Learning OS migration 0163', () => {
  it('creates every durable Hermes table with trusted organization scope', () => {
    const content = migrationSql();
    for (const table of TABLES) {
      expect(content).toMatch(new RegExp(`create table if not exists public\\.${table}`, 'i'));
    }
    const organizationColumns = content.match(/organization_id\s+uuid\s+not null/gi) ?? [];
    expect(organizationColumns.length).toBeGreaterThanOrEqual(TABLES.length);
  });

  it('enables tenant RLS using the canonical fn_user_org_ids helper', () => {
    const content = migrationSql();
    for (const table of TABLES) {
      expect(content).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
      );
      expect(content).toMatch(
        new RegExp(`tenant_isolation_${table}_all[\\s\\S]*fn_user_org_ids\\(\\)`, 'i'),
      );
    }
    expect(content).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(content).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });

  it('preserves legacy proposal types and adds the complete Hermes allowlist', () => {
    const content = migrationSql();
    for (const type of PROPOSAL_TYPES) {
      expect(content).toContain(`'${type}'`);
    }
  });

  it('contains no network side effect trigger', () => {
    const content = migrationSql();
    expect(content).not.toMatch(/http_post|http_get|net\.http|pg_net/i);
  });

  it('bounds quality, cost, latency and trust states in the database', () => {
    const content = migrationSql();
    expect(content).toMatch(/technical_quality\s*>=\s*0[\s\S]*technical_quality\s*<=\s*1/i);
    expect(content).toMatch(/cost_cents\s*>=\s*0/i);
    expect(content).toMatch(/latency_ms\s*>=\s*0/i);
    expect(content).toMatch(/trust_status[\s\S]*'stale'/i);
  });
});
