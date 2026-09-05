/**
 * RGPD domain types for Lumenva.
 * Mapped from docs/specs/01-spec-platform-base.md §8.1 and Spec 06 §5.6.
 */

/**
 * Os TRÊS valores que o banco aceita — `lgpd_requests_request_type_check`.
 *
 * A UI e as rotas usavam `customer_redact`/`customer_data_request`, que o CHECK
 * REJEITA: todo pedido criado com esse vocabulário estourava no INSERT, e o
 * filtro por tipo na tela nunca casava com nada. Se for preciso renomear, o
 * caminho é migration primeiro, este tipo depois — nunca só aqui.
 */
export type LgpdRequestType = "data_request" | "redact" | "store_redact";

/** Rótulo em pt-BR — fonte única, para as cinco telas não divergirem. */
export const LGPD_REQUEST_TYPE_LABELS: Record<LgpdRequestType, string> = {
  data_request: "Solicitação de dados",
  redact: "Anonimização cliente",
  store_redact: "Anonimização tenant",
};

export type LgpdScope = "contact" | "tenant";

export type LgpdRequestStatus =
  | "received"
  | "processing"
  | "completed"
  | "failed"
  | "pending_review";

export type RgpdRequestStatus =
  | "received"
  | "in_review"
  | "extension_notified"
  | "responded"
  | "refused";

export interface LgpdRequest {
  id: string;
  organization_id: string;
  request_type: LgpdRequestType;
  /** Origin channel that triggered the request. */
  source: "nuvemshop" | "admin_panel" | "api";
  /** Internal contact id (may be null if contact not yet in CRM — L-03). */
  contact_id: string | null;
  /** Nuvemshop customer id or other external platform identifier. */
  external_customer_id: string | null;
  status: LgpdRequestStatus;
  /** New RGPD state; null while legacy rows are not backfilled. */
  rgpd_status?: RgpdRequestStatus | null;
  attempts: number;
  received_at: string; // ISO 8601 UTC
  due_at: string; // ISO 8601 UTC
  completed_at: string | null;
  /** Raw webhook payload + context. PII stored here, never in audit log. */
  request_payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  cascaded_to: Record<string, unknown> | null;
  /** Whether this request is high-priority (drives early SLA alarms). */
  emergency: boolean;
  /** Scope of the request: 'contact' (single customer) or 'tenant' (full store uninstall). */
  scope: LgpdScope;
  extension_reason?: string | null;
  extension_notified_at?: string | null;
  refusal_grounds?: string | null;
  refusal_communicated_at?: string | null;
  created_at: string;
  updated_at: string;
}
