export type TenantReadContext = {
  userId: string;
  organizationId: string;
  role: 'viewer' | 'agent' | 'manager' | 'admin' | 'platform_admin';
  requestId: string;
};

export type ShadowMode = 'off' | 'observe' | 'sampled' | 'enforced';

export type MismatchType = 'missing' | 'extra' | 'field' | 'ordering' | 'timeout' | 'error' | 'authorization';

export interface DomainNormalizer<Row, Canonical> {
  normalize(row: Row | null): Canonical | null;
  normalizeList(rows: readonly Row[]): Canonical[];
}

export type ShadowLogPayload = {
  domain: string;
  organization_id: string;
  shadow_mode: ShadowMode;
  mismatch_type?: MismatchType;
  differences?: Array<{ path: string }>;
  difference_count?: number;
  legacy_duration_ms: number;
  shadow_duration_ms?: number;
  timestamp: string;
};
