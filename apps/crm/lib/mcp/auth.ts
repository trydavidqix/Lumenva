/**
 * Bearer-token auth para o MCP server.
 *
 * Reutiliza `api_tokens` (EPIC-01 / Spec 01 §api-tokens). Plain bearer
 * (`dsk_<prefix>_<secret>`) e hashado SHA256 e batido contra `token_hash`.
 * Nunca logamos plaintext (Sentry beforeSend strip ja cobre `authorization`).
 *
 * Atributos extras (actor_type, agent_run_id, role) ficam em `scopes`
 * como tokens convencionais, sem migration:
 *   `role:manager`     -> role override (default `agent`)
 *   `actor:ai_agent`   -> marca actor_type (default `user`)
 *   `agent_run:<uuid>` -> vincula tool_call ao run (Spec 10)
 *   `mcp:read`         -> habilita read tools desta wave
 *   `mcp:write`        -> habilita write tools (S-13.04)
 */
import { createHash } from "node:crypto";

import type { Actor } from "@/lib/api/handlers/types";
import type { ActorRole } from "@/lib/auth/types";
import { isActorRole, isHumanRole, ROLE_RANK } from "@/lib/auth/types";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export interface McpAuthResult {
  organizationId: string;
  role: ActorRole;
  actor: Actor;
  apiTokenId: string;
  scopes: string[];
}

export class McpAuthError extends Error {
  constructor(
    public readonly mcpCode: number,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

const VALID_ROLES = new Set<ActorRole>(["viewer", "agent", "ai_operator", "manager", "admin"]);

function parseScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string");
}

function scopesRole(scopes: string[]): ActorRole {
  const roleScope = scopes.find((s) => s.startsWith("role:"));
  if (!roleScope) return "agent";

  const role = roleScope.slice("role:".length);
  if (isActorRole(role) && VALID_ROLES.has(role)) {
    return role;
  }

  throw new McpAuthError(-32001, 401, "Invalid token role.");
}

function deriveActor(scopes: string[], tokenId: string, role: ActorRole): Actor {
  const isAiAgent = scopes.includes("actor:ai_agent");
  if (isAiAgent) {
    const runScope = scopes.find((s) => s.startsWith("agent_run:"));
    const runId = runScope ? runScope.slice("agent_run:".length) : tokenId;
    return { type: "ai_agent", id: runId, role, api_token_id: tokenId };
  }
  if (!isHumanRole(role)) {
    throw new McpAuthError(-32001, 401, "Internal actor role requires an AI actor token.");
  }
  return { type: "user", id: tokenId, role };
}

export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!m) return null;
  return m[1]!.trim();
}

export async function validateBearerToken(
  authHeader: string | null,
): Promise<McpAuthResult> {
  const plaintext = extractBearer(authHeader);
  if (!plaintext) {
    throw new McpAuthError(-32001, 401, "Missing or malformed Authorization header.");
  }
  if (!plaintext.startsWith("dsk_")) {
    throw new McpAuthError(-32001, 401, "Invalid token format.");
  }

  const tokenHash = createHash("sha256").update(plaintext).digest();
  const hashLiteral = `\\x${tokenHash.toString("hex")}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, organization_id, scopes, revoked_at, expires_at")
    .eq("token_hash", hashLiteral)
    .maybeSingle();

  if (error) {
    throw new McpAuthError(-32603, 500, `Token lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new McpAuthError(-32001, 401, "Token not recognized.");
  }
  if (data.revoked_at) {
    throw new McpAuthError(-32001, 401, "Token revoked.");
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new McpAuthError(-32001, 401, "Token expired.");
  }

  const scopes = parseScopes(data.scopes);
  const role = scopesRole(scopes);
  const actor = deriveActor(scopes, data.id, role);

  supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(({ error: updErr }) => {
      if (updErr) logger.error("mcp.auth: last_used_at update failed", { error: updErr.message });
    });

  return {
    organizationId: data.organization_id,
    role,
    actor,
    apiTokenId: data.id,
    scopes,
  };
}

export function ensureRole(actual: ActorRole, minimum: ActorRole): void {
  if (ROLE_RANK[actual] < ROLE_RANK[minimum]) {
    throw new McpAuthError(
      -32002,
      403,
      `Role '${actual}' insufficient (required: '${minimum}').`,
    );
  }
}

export function ensureScope(scopes: string[], required: string): void {
  if (!scopes.includes(required)) {
    throw new McpAuthError(-32002, 403, `Token missing required scope '${required}'.`);
  }
}
