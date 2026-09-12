import { describe, expect, it } from 'vitest';

import { ComponentRegistry, type ComponentKind } from './component-registry';

const definition = (name: string, kind: ComponentKind = 'component') => ({
  name,
  kind,
  version: 'v1',
});

describe('ComponentRegistry', () => {
  it('registers a unique catalog name and rejects a duplicate of the same kind', () => {
    const registry = new ComponentRegistry();
    registry.register(definition('billing'));

    expect(() => registry.register(definition('billing'))).toThrow(
      'component name already registered: billing',
    );
    expect(registry.get('billing')).toEqual(definition('billing'));
  });

  it('rejects the same name across component, skill and agent kinds', () => {
    const registry = new ComponentRegistry();
    registry.register(definition('shared-name', 'skill'));

    expect(() => registry.register(definition('shared-name', 'agent'))).toThrow(
      'component name already registered: shared-name',
    );
  });
});
