export const REDACTED = "[REDACTED]" as const;

const SECRET_KEY = /(authorization|cookie|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?(key|auth|credential)|bearer)/i;
const MESSAGE_BODY_KEY = /^(body|text|message|message_body|content_text)$/i;
const PII_KEY = /^(phone|phone_number|email|cpf|tax_id)$/i;

function shouldRedactKey(key: string): boolean {
  return SECRET_KEY.test(key) || MESSAGE_BODY_KEY.test(key) || PII_KEY.test(key);
}

export function sanitizeGatewayLogValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeGatewayLogValue(item, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (typeof value !== "object") return String(value);

  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = shouldRedactKey(key) ? REDACTED : sanitizeGatewayLogValue(nested, depth + 1);
  }
  return sanitized;
}

export function sanitizeGatewayLogContext(
  context: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return sanitizeGatewayLogValue(context) as Record<string, unknown>;
}

export function assertGatewayTenantScope(expectedOrganizationId: string, resourceOrganizationId: string): void {
  if (!expectedOrganizationId || expectedOrganizationId !== resourceOrganizationId) {
    throw new Error("gateway_cross_tenant_access_denied");
  }
}

export interface UntrustedExternalContent<T = unknown> {
  trust: "untrusted_external";
  value: T;
}

export function markExternalContentUntrusted<T>(value: T): UntrustedExternalContent<T> {
  return { trust: "untrusted_external", value };
}

export type ToolRisk = "read" | "low_risk_write" | "transactional" | "high_risk";
export type AuthoritySource = "system" | "agent_policy" | "tool_policy" | "user" | "external_content";

export interface ToolAuthorizationDecision {
  allowed: boolean;
  code:
    | "allowed"
    | "shadow_side_effect_denied"
    | "external_content_cannot_authorize"
    | "high_risk_requires_policy";
}

export function authorizeGatewayToolCall(input: {
  risk: ToolRisk;
  authority: AuthoritySource;
  shadowMode: boolean;
  explicitlyAllowedByPolicy: boolean;
}): ToolAuthorizationDecision {
  const sideEffecting = input.risk !== "read";

  if (input.shadowMode && sideEffecting) {
    return { allowed: false, code: "shadow_side_effect_denied" };
  }

  if (input.authority === "external_content" && sideEffecting) {
    return { allowed: false, code: "external_content_cannot_authorize" };
  }

  if (input.risk === "high_risk" && !input.explicitlyAllowedByPolicy) {
    return { allowed: false, code: "high_risk_requires_policy" };
  }

  return { allowed: true, code: "allowed" };
}
