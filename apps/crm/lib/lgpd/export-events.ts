import { audit } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit/actions";

export type ExportEvent = "generated" | "delivered" | "failed";

const ACTIONS: Record<ExportEvent, AuditAction> = {
  generated: "lgpd.export_generated",
  delivered: "lgpd.export_delivered",
  failed: "lgpd.export_failed",
};

export interface ExportEventInput {
  event: ExportEvent;
  requestId: string;
  organizationId: string;
  exportSha256?: string;
  manifestSha256?: string;
  fileCount?: number;
  signedPades?: boolean;
  errorCode?: string;
}

/** Registers export lifecycle events without putting payload/PII in audit metadata. */
export async function recordExportEvent(input: ExportEventInput): Promise<void> {
  await audit({
    action: ACTIONS[input.event],
    organizationId: input.organizationId,
    resourceType: "lgpd_export",
    resourceId: input.requestId,
    requestId: input.requestId,
    metadata: {
      export_sha256: input.exportSha256,
      manifest_sha256: input.manifestSha256,
      file_count: input.fileCount,
      signed_pades: input.signedPades ?? false,
      error_code: input.errorCode,
    },
  });
}
