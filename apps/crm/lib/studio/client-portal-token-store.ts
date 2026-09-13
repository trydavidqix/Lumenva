import { createHash } from "node:crypto";
import type { ClientPortalToken, PortalScope } from "./project-spec";

export interface PortalTokenQueryable {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }>;
}

export type ConsumeClientPortalTokenInput = {
  token: string;
  projectId: string;
  organizationId: string;
  requiredScope: PortalScope;
  now: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createPostgresClientPortalTokenStore(db: PortalTokenQueryable) {
  return {
    async issue(record: ClientPortalToken): Promise<void> {
      await db.query(
        `insert into public.studio_client_portal_tokens
           (token_id, project_id, organization_id, token_hash, scope, expires_at,
            revoked_at, single_use, created_by, used_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (token_id) do update set token_hash = excluded.token_hash,
           scope = excluded.scope, expires_at = excluded.expires_at,
           revoked_at = excluded.revoked_at, single_use = excluded.single_use,
           created_by = excluded.created_by, used_at = excluded.used_at`,
        [
          record.token_id,
          record.project_id,
          record.organization_id,
          record.token_hash,
          record.scope,
          record.expires_at,
          record.revoked_at ?? null,
          record.single_use ?? false,
          record.created_by,
          record.used_at ?? null,
        ],
      );
    },

    async consume(input: ConsumeClientPortalTokenInput): Promise<ClientPortalToken | null> {
      const { rows } = await db.query<ClientPortalToken>(
        `update public.studio_client_portal_tokens
            set used_at = case when single_use then $5::timestamptz else used_at end
          where organization_id = $1
            and project_id = $2
            and token_hash = $3
            and revoked_at is null
            and expires_at > $6::timestamptz
            and (scope = $4 or (scope = 'COMMENT' and $4 = 'VIEW'))
            and (single_use = false or used_at is null)
          returning token_id, project_id, organization_id, token_hash, scope,
                    expires_at, revoked_at, single_use, created_by, used_at`,
        [
          input.organizationId,
          input.projectId,
          hashToken(input.token),
          input.requiredScope,
          input.now,
          input.now,
        ],
      );
      return rows[0] ?? null;
    },
  };
}
