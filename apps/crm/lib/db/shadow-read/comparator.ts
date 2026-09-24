import type { MismatchType } from './types';

export type Difference = {
  path: string;
  legacyValue: unknown;
  shadowValue: unknown;
};

export class ShadowComparator {
  public compare<T extends Record<string, unknown>>(
    legacy: T | null,
    shadow: T | null
  ): { mismatchType?: MismatchType; differences: Difference[] } {
    if (legacy === null && shadow === null) {
      return { differences: [] };
    }
    if (legacy !== null && shadow === null) {
      return { mismatchType: 'missing', differences: [{ path: 'root', legacyValue: legacy, shadowValue: shadow }] };
    }
    if (legacy === null && shadow !== null) {
      return { mismatchType: 'extra', differences: [{ path: 'root', legacyValue: legacy, shadowValue: shadow }] };
    }

    const differences: Difference[] = [];

    const legacyRec = legacy as T;
    const shadowRec = shadow as T;

    const allKeys = new Set([...Object.keys(legacyRec), ...Object.keys(shadowRec)]);

    // Check all fields from both sides
    for (const key of allKeys) {
      if (legacyRec[key] !== shadowRec[key]) {
        differences.push({ path: key, legacyValue: legacyRec[key], shadowValue: shadowRec[key] });
      }
    }

    if (differences.length > 0) {
      // Always treat tenant, auth, visibility mismatch as 'authorization'
      const hasAuthMismatch = differences.some(d => d.path === 'organization_id' || d.path === 'role' || d.path === 'visibility');
      return {
        mismatchType: hasAuthMismatch ? 'authorization' : 'field',
        differences
      };
    }

    return { differences: [] };
  }

  public compareList<T extends Record<string, unknown>>(
    legacy: readonly T[],
    shadow: readonly T[]
  ): { mismatchType?: MismatchType; differences: Difference[] } {
    if (legacy.length !== shadow.length) {
      return {
        mismatchType: legacy.length > shadow.length ? 'missing' : 'extra',
        differences: [{ path: 'length', legacyValue: legacy.length, shadowValue: shadow.length }]
      };
    }

    for (let i = 0; i < legacy.length; i++) {
      const cmp = this.compare(legacy[i] as T | null, shadow[i] as T | null);
      if (cmp.differences.length > 0) {
        return {
          mismatchType: cmp.mismatchType || 'ordering',
          differences: cmp.differences.map(d => ({ ...d, path: `[${i}].${d.path}` }))
        };
      }
    }

    return { differences: [] };
  }
}
