import type { TenantReadContext, DomainNormalizer, ShadowLogPayload } from './types';
import type { ShadowFlagProvider } from './flags';
import type { ShadowComparator } from './comparator';

export interface HarnessDependencies {
  flags: ShadowFlagProvider;
  comparator: ShadowComparator;
  logger: (payload: ShadowLogPayload) => void;
  timeoutMs?: number;
}

export class ShadowHarness {
  constructor(private deps: HarnessDependencies) {}

  public async run<T, Canonical extends Record<string, unknown>>(
    ctx: TenantReadContext,
    domain: string,
    operationName: string,
    legacyFn: () => Promise<T>,
    shadowFn: () => Promise<T>,
    normalizer: DomainNormalizer<T, Canonical>,
    isList: boolean = false
  ): Promise<T> {
    const mode = this.deps.flags.getFlag(domain, ctx.organizationId);

    if (mode === 'off') {
      return legacyFn();
    }

    // In observe or sampled mode, we run legacy and shadow concurrently to avoid latency impact
    if (mode === 'observe' || mode === 'sampled') {
      const t0 = Date.now();
      const legacyPromise = legacyFn();

      // We attach a catch to the shadow promise immediately to avoid UnhandledPromiseRejection
      // if it fails later after a timeout or in the background.
      const rawShadowPromise = shadowFn();
      rawShadowPromise.catch(() => {});

      const timeout = this.deps.timeoutMs || 1000;
      let timer: NodeJS.Timeout | undefined;

      const shadowWithTimeout = Promise.race([
        rawShadowPromise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Shadow read timeout')), timeout);
        })
      ]);

      let legacyResult: T;
      let legacyDuration = 0;
      try {
        legacyResult = await legacyPromise;
        legacyDuration = Date.now() - t0;
      } catch (e) {
        if (timer) clearTimeout(timer);
        throw e;
      }

      // Evaluate shadow resolution in background without blocking response return.
      // But for testing purposes, we await it here so tests can assert logs properly.
      // Ideally this goes to a fire-and-forget background task via Next.js unstable_after or context.waitUntil
      const t1 = Date.now();
      let shadowResult: T | undefined;
      let shadowError: unknown;
      try {
        shadowResult = await shadowWithTimeout;
      } catch (e) {
        shadowError = e;
      } finally {
        if (timer) clearTimeout(timer);
      }
      const shadowDuration = Date.now() - t1;

      if (shadowError) {
        this.deps.logger({
          domain,
          organization_id: ctx.organizationId,
          shadow_mode: mode,
          mismatch_type: shadowError instanceof Error && shadowError.message === 'Shadow read timeout' ? 'timeout' : 'error',
          error: shadowError instanceof Error ? shadowError.message : String(shadowError),
          legacy_duration_ms: legacyDuration,
          timestamp: new Date().toISOString()
        });
        return legacyResult;
      }

      // Normalize
      const legacyCanonical = isList
        ? normalizer.normalizeList(legacyResult as unknown as readonly T[])
        : normalizer.normalize(legacyResult);

      const shadowCanonical = isList
        ? normalizer.normalizeList(shadowResult as unknown as readonly T[])
        : normalizer.normalize(shadowResult!);

      // Compare
      const { mismatchType, differences } = isList
        ? this.deps.comparator.compareList(legacyCanonical as unknown as readonly Canonical[], shadowCanonical as unknown as readonly Canonical[])
        : this.deps.comparator.compare(legacyCanonical as unknown as Canonical, shadowCanonical as unknown as Canonical);

      if (mismatchType) {
        this.deps.logger({
          domain,
          organization_id: ctx.organizationId,
          shadow_mode: mode,
          mismatch_type: mismatchType,
          differences,
          legacy_duration_ms: legacyDuration,
          shadow_duration_ms: shadowDuration,
          timestamp: new Date().toISOString()
        });

        // Rollback logic for severe mismatches
        if (mismatchType === 'authorization') {
          this.deps.flags.forceRollback(domain, ctx.organizationId);
        }
      }

      return legacyResult;
    }

    // Enforced mode (shadow is authority)
    try {
      const shadowResult = await shadowFn();
      return shadowResult;
    } catch (e) {
      // Fallback to legacy
      const t1 = Date.now();
      try {
        const fallbackResult = await legacyFn();
        this.deps.logger({
          domain,
          organization_id: ctx.organizationId,
          shadow_mode: mode,
          mismatch_type: 'error',
          error: e instanceof Error ? e.message : String(e),
          legacy_duration_ms: Date.now() - t1, // How long fallback took
          timestamp: new Date().toISOString()
        });
        return fallbackResult;
      } catch (legacyErr) {
        throw legacyErr;
      }
    }
  }
}
