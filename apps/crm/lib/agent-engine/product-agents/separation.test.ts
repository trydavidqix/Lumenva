import { describe, expect, it } from 'vitest';

import {
  CONTROL_AGENT_IDS,
  CUSTOMER_PRODUCT_AGENT_IDS,
  isControlAgentId,
  isCustomerProductAgentId,
  isProductAgentId,
} from './contracts';
import { getControlAgentDefinition } from './definitions';

describe('product/control agent separation', () => {
  it('classifies customer-facing and control-plane ids as disjoint sets', () => {
    expect(CUSTOMER_PRODUCT_AGENT_IDS.some((id) => CONTROL_AGENT_IDS.includes(id as never))).toBe(false);
    for (const id of CUSTOMER_PRODUCT_AGENT_IDS) {
      expect(isCustomerProductAgentId(id)).toBe(true);
      expect(isControlAgentId(id)).toBe(false);
      expect(isProductAgentId(id)).toBe(true);
    }
    for (const id of CONTROL_AGENT_IDS) {
      expect(isControlAgentId(id)).toBe(true);
      expect(isCustomerProductAgentId(id)).toBe(false);
      expect(getControlAgentDefinition(id)).not.toBeNull();
    }
  });
});
