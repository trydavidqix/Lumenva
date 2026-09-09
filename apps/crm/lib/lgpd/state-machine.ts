import type { RgpdRequestStatus } from "./types";

const legacyToRgpd: Record<string, RgpdRequestStatus> = {
  received: "received",
  processing: "in_review",
  completed: "responded",
  failed: "refused",
  expired: "refused",
  pending_review: "in_review",
};

export function readRgpdStatus(row: { rgpd_status?: string | null; status?: string | null }): RgpdRequestStatus | null {
  if (row.rgpd_status && ["received", "in_review", "extension_notified", "responded", "refused"].includes(row.rgpd_status)) {
    return row.rgpd_status as RgpdRequestStatus;
  }
  return row.status ? legacyToRgpd[row.status] ?? null : null;
}
