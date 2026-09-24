import type { TenantReadContext, DomainNormalizer, MismatchType, ShadowLogPayload } from './types';
import type { ShadowFlagProvider } from './flags';
import type { ShadowComparator, Difference } from './comparator';

export interface HarnessDependencies {
  flags: ShadowFlagProvider;
  comparator: ShadowComparator;
  logger: (payload: ShadowLogPayload) => void;
  timeoutMs?: number;
}

class ShadowTimeoutError extends Error {
  constructor() {
    super('Shadow read timed out');
    this.name = 'ShadowTimeoutError';
  }
}

function getTimeoutMs(value: number | undefined): number {
  return Number.isFinite(value) && value !== undefined && value > 0 ? value : 1000;
}

function tenantScopeMatches(result: unknown, organizationId: string, isList: boolean): boolean {
  if (result === null) return true;
  const rows: readonly unknown[] = isList
    ? Array.isArray(result) ? result : []
    : [result];
  if (!isList && rows.length === 0) return false;

  return rows.every((row) =>
    typeof row === 'object' && row !== null &&
    'organization_id' in row && row.organization_id === organizationId
  );
}

function safeDifferences(differences: readonly Difference[]): Array<{ path: string }> {
  return differences.map(({ path }) => ({ path }));
}

export class ShadowHarness {
  constructor(private deps: HarnessDependencies) {}

  private log(
    domain: string,
    organizationId: string,
    mode: ShadowLogPayload['shadow_mode'],
    mismatchType: MismatchType,
    legacyDurationMs: number,
    shadowDurationMs?: number,
    differences: readonly Difference[] = []
  ): void {
    this.deps.logger({
      domain,
      organization_id: organizationId,
      shadow_mode: mode,
      mismatch_type: mismatchType,
      differences: safeDifferences(differences),
      difference_count: differences.length,
      legacy_duration_ms: legacyDurationMs,
      ...(shadowDurationMs === undefined ? {} : { shadow_duration_ms: shadowDurationMs }),
      timestamp: new Date().toISOString()
    });
  }

  private compare<T, Canonical extends Record<string, unknown>>(
    legacyResult: T,
    shadowResult: T,
    normalizer: DomainNormalizer<T, Canonical>,
    isList: boolean
  ): { mismatchType?: MismatchType; differences: Difference[] } {
    const legacyCanonical = isList
      ? normalizer.normalizeList(legacyResult as unknown as readonly T[])
      : normalizer.normalize(legacyResult);
    const shadowCanonical = isList
      ? normalizer.normalizeList(shadowResult as unknown as readonly T[])
      : normalizer.normalize(shadowResult);

    return isList
      ? this.deps.comparator.compareList(
        legacyCanonical as unknown as readonly Canonical[],
        shadowCanonical as unknown as readonly Canonical[]
      )
      : this.deps.comparator.compare(
        legacyCanonical as unknown as Canonical,
        shadowCanonical as unknown as Canonical
      );
  }

  public async run<T, Canonical extends Record<string, unknown>>(
    ctx: TenantReadContext,
    domain: string,
    operationName: string,
    legacyFn: () => Promise<T>,
    shadowFn: () => Promise<T>,
    normalizer: DomainNormalizer<T, Canonical>,
    isList: boolean = false
  ): Promise<T> {
    // Platform-admin access uses explicit audited legacy routes; tenant shadow adapters cannot represent it.
    if (ctx.role === 'platform_admin') return legacyFn();

    const mode = this.deps.flags.getFlag(domain, ctx.organizationId);
    if (mode === 'off') return legacyFn();

    const startedAt = Date.now();
    const legacyPromise = legacyFn();
    const rawShadowPromise = Promise.resolve().then(shadowFn);
    rawShadowPromise.catch(() => {});
    const timeoutMs = getTimeoutMs(this.deps.timeoutMs);
    let timer: NodeJS.Timeout | undefined;
    const shadowPromise = Promise.race([
      rawShadowPromise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ShadowTimeoutError()), timeoutMs);
      })
    ]);

    let legacyResult: T;
    try {
      legacyResult = await legacyPromise;
    } catch (error) {
      if (timer) clearTimeout(timer);
      throw error;
    }
    const legacyDuration = Date.now() - startedAt;

    if (mode === 'observe' || mode === 'sampled') {
      const shadowStartedAt = Date.now();
      try {
        const shadowResult = await shadowPromise;
        const comparison = this.compare(legacyResult, shadowResult, normalizer, isList);
        if (comparison.mismatchType) {
          this.log(domain, ctx.organizationId, mode, comparison.mismatchType, legacyDuration,
            Date.now() - shadowStartedAt, comparison.differences);
          if (comparison.mismatchType === 'authorization') this.deps.flags.forceRollback(domain, ctx.organizationId);
        }
      } catch (error) {
        const mismatchType = error instanceof ShadowTimeoutError ? 'timeout' : 'error';
        this.log(domain, ctx.organizationId, mode, mismatchType, legacyDuration, Date.now() - shadowStartedAt);
      } finally {
        if (timer) clearTimeout(timer);
      }

      return legacyResult;
    }

    const shadowStartedAt = Date.now();
    try {
      const shadowResult = await shadowPromise;
      if (!tenantScopeMatches(shadowResult, ctx.organizationId, isList)) {
        this.log(domain, ctx.organizationId, mode, 'authorization', legacyDuration, Date.now() - shadowStartedAt,
          [{ path: 'organization_id', legacyValue: undefined, shadowValue: undefined }]);
        this.deps.flags.forceRollback(domain, ctx.organizationId);
        return legacyResult;
      }

      const comparison = this.compare(legacyResult, shadowResult, normalizer, isList);
      if (comparison.mismatchType) {
        this.log(domain, ctx.organizationId, mode, comparison.mismatchType, legacyDuration,
          Date.now() - shadowStartedAt, comparison.differences);
        this.deps.flags.forceRollback(domain, ctx.organizationId);
        return legacyResult;
      }

      return shadowResult;
    } catch (error) {
      const mismatchType = error instanceof ShadowTimeoutError ? 'timeout' : 'error';
      this.log(domain, ctx.organizationId, mode, mismatchType, legacyDuration, Date.now() - shadowStartedAt);
      return legacyResult;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
