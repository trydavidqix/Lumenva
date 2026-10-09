import { describe, it, expect } from 'vitest';
import { evaluateRule, type AutomationRule } from './automation-rules';

describe('Automation Rules', () => {
  it('should trigger on exact keyword match', () => {
    const rule: AutomationRule = {
      id: 'rule-1',
      enabled: true,
      condition: {
        type: 'exact_match',
        keyword: 'PROMO'
      },
      action: {
        type: 'send_message',
        payload: 'Here is your promo code!'
      }
    };

    expect(evaluateRule(rule, 'PROMO')).toBe(true);
    expect(evaluateRule(rule, 'promo')).toBe(true); // case insensitive
    expect(evaluateRule(rule, 'PROMO CODE')).toBe(false);
  });

  it('should not trigger if disabled (kill switch)', () => {
    const rule: AutomationRule = {
      id: 'rule-1',
      enabled: false,
      condition: {
        type: 'exact_match',
        keyword: 'PROMO'
      },
      action: {
        type: 'send_message',
        payload: 'Here is your promo code!'
      }
    };

    expect(evaluateRule(rule, 'PROMO')).toBe(false);
  });

  it('should trigger on contains match', () => {
    const rule: AutomationRule = {
      id: 'rule-2',
      enabled: true,
      condition: {
        type: 'contains',
        keyword: 'help'
      },
      action: {
        type: 'send_message',
        payload: 'How can I help you?'
      }
    };

    expect(evaluateRule(rule, 'I need help please')).toBe(true);
    expect(evaluateRule(rule, 'hello')).toBe(false);
  });
});
