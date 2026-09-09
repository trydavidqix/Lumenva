import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface GoldenCase {
  id: string;
  scenario?: string;
  expected?: {
    expected_facts?: string[];
    allowed_tools?: string[];
    forbidden_actions?: string[];
    expected_escalation?: string | null;
    expected_policy_outcome?: string;
    scoring?: Record<string, unknown>;
  };
}

const cases = JSON.parse(
  readFileSync(join(process.cwd(), 'apps/crm/tests/fixtures/agent-os/phase-1-6-golden-cases.json'), 'utf8'),
) as GoldenCase[];

const REQUIRED_SCENARIOS = [
  'customer_asks_price',
  'customer_wants_cancellation',
  'angry_customer',
  'interested_lead',
  'lead_without_budget',
  'discount_request',
  'ambiguous_message',
  'prompt_injection',
  'cross_tenant_data_request',
  'credential_request',
  'destructive_request',
  'repeated_tool_loop',
  'provider_failure',
] as const;

describe('Agent OS Phase 1.6 baseline golden eval dataset', () => {
  it('cobre todos os cenários mínimos do plano 1.6', () => {
    const scenarios = new Set(cases.map((item) => item.scenario));
    for (const scenario of REQUIRED_SCENARIOS) {
      expect(scenarios.has(scenario), `missing scenario: ${scenario}`).toBe(true);
    }
  });

  it('cada caso governado define fatos, tools, proibições, policy/escalation e scoring', () => {
    for (const item of cases) {
      expect(item.scenario, `${item.id}: scenario`).toBeTruthy();
      expect(Array.isArray(item.expected?.expected_facts), `${item.id}: expected_facts`).toBe(true);
      expect(Array.isArray(item.expected?.allowed_tools), `${item.id}: allowed_tools`).toBe(true);
      expect(Array.isArray(item.expected?.forbidden_actions), `${item.id}: forbidden_actions`).toBe(true);
      expect(item.expected).toHaveProperty('expected_escalation');
      expect(item.expected?.expected_policy_outcome, `${item.id}: expected_policy_outcome`).toBeTruthy();
      expect(item.expected?.scoring, `${item.id}: scoring`).toBeTruthy();
    }
  });

  it('mantém assertions determinísticas de segurança separadas do scoring subjetivo', () => {
    const highRisk = cases.filter((item) =>
      ['prompt_injection', 'cross_tenant_data_request', 'credential_request', 'destructive_request'].includes(
        item.scenario ?? '',
      ),
    );
    expect(highRisk).toHaveLength(4);
    for (const item of highRisk) {
      expect(item.expected?.expected_policy_outcome).toMatch(/deny|escalate|require_approval/);
      expect((item.expected?.forbidden_actions ?? []).length).toBeGreaterThan(0);
    }
  });
});
