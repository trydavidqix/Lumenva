import type { LayerLicenseRecord } from "./layer-manifest";

type Queryable = { query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }> };

type LicenseRow = {
  license_ref: string;
  organization_id: string;
  source_id: string;
  owner_id: string;
  status: LayerLicenseRecord["status"];
  expires_at: string | null;
};

function toLicense(row: LicenseRow): LayerLicenseRecord {
  return {
    license_ref: row.license_ref,
    source_id: row.source_id,
    owner_id: row.owner_id,
    status: row.status,
    expires_at: row.expires_at,
  };
}

export class PostgresLayerLicenseStore {
  constructor(private readonly db: Queryable) {}

  async loadForTenant(organizationId: string, licenseRef: string): Promise<LayerLicenseRecord | null> {
    if (!organizationId.trim() || !licenseRef.trim()) throw new Error("asset_license_lookup_invalid");
    const result = await this.db.query<LicenseRow>(
      `select license_ref, organization_id, source_id, owner_id, status, expires_at
       from public.asset_license_records where organization_id=$1 and license_ref=$2`,
      [organizationId, licenseRef],
    );
    return result.rows[0] ? toLicense(result.rows[0]) : null;
  }
}
