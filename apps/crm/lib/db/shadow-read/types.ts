export type TenantReadContext = {
  userId: string;
  organizationId: string;
  role: 'viewer' | 'agent' | 'manager' | 'admin';
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
  differences?: unknown[];
  legacy_duration_ms: number;
  shadow_duration_ms?: number;
  error?: string;
  timestamp: string;
};
