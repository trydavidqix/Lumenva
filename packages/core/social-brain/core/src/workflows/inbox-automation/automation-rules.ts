export interface AutomationRule {
  id: string;
  enabled: boolean;
  condition: {
    type: 'exact_match' | 'contains';
    keyword: string;
  };
  action: {
    type: 'send_message';
    payload: string;
  };
}

export function evaluateRule(rule: AutomationRule, content: string): boolean {
  if (!rule.enabled) {
    return false;
  }

  const normalizedContent = content.trim().toLowerCase();
  const normalizedKeyword = rule.condition.keyword.trim().toLowerCase();

  if (rule.condition.type === 'exact_match') {
    return normalizedContent === normalizedKeyword;
  } else if (rule.condition.type === 'contains') {
    return normalizedContent.includes(normalizedKeyword);
  }

  return false;
}
