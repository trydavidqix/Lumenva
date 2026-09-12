/**
 * Zod schema for `GET /api/v1/audit` query params (EPIC-10 wave 1).
 *
 * Cursor format: base64url(`{created_at}|{id}`) — keyset pagination over
 * (created_at DESC, id DESC). Opaque to clients.
 */
import { z } from "zod";

export const auditQuerySchema = z.object({
  actor_id: z.string().uuid().optional(),
  action: z.string().min(1).max(100).optional(),
  resource_type: z.string().min(1).max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditCursor {
  created_at: string;
  id: string;
}

const auditCursorSchema = z.object({
  created_at: z.string().datetime(),
  id: z.string().uuid(),
});

export function encodeAuditCursor(c: AuditCursor): string {
  return Buffer.from(`${c.created_at}|${c.id}`, "utf8").toString("base64url");
}

export function decodeAuditCursor(raw: string): AuditCursor | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 2) return null;
    const parsed = auditCursorSchema.safeParse({ created_at: parts[0], id: parts[1] });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
