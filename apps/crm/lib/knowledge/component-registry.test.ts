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

  it('normalizes case and surrounding whitespace for register and get', () => {
    const registry = new ComponentRegistry();
    registry.register(definition('  Timao  '));

    expect(registry.get('timao')).toEqual(definition('Timao'));
    expect(registry.get('  TIMAO ')).toEqual(definition('Timao'));
    expect(() => registry.register(definition('timao'))).toThrow(
      'component name already registered: timao',
    );
  });

  it('uses Unicode NFKC before lowercasing the registry key', () => {
    const registry = new ComponentRegistry();
    registry.register(definition('Ｔimao'));

    expect(registry.get('timao')).toEqual(definition('Ｔimao'));
    expect(() => registry.register(definition('Timao'))).toThrow(
      'component name already registered: Timao',
    );
  });
});
