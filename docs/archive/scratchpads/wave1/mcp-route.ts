/**
 * GET /api/v1/mcp/tools
 *
 * Catalogo de tools MCP serializado para a UI consumir (Spec 11 + EPIC-13
 * S-13.03 AC). Usa cookie session (Spec 01 auth dual). Resposta:
 *   { data: { tools: [{ id, description, input_schema, category, requires_role,
 *                       rotulo, explicacao, o_que_toca, risco, pacotes }] } }
 *
 * `input_schema` e o JSON Schema gerado a partir do Zod raw shape.
 *
 * DUAS AUDIENCIAS NA MESMA RESPOSTA: `description` e `input_schema` sao do
 * MODELO; `rotulo`/`explicacao`/`o_que_toca`/`risco`/`pacotes` sao do HUMANO
 * que configura o agente. A juncao das duas metades (e a recusa em servir uma
 * capacidade sem a metade do humano) vive em `catalogo-servido.ts`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { McpAuthError, validateBearerToken } from "@/lib/mcp/auth";
import { invokeLumenvaCommand } from "@/lib/cli/lumenva";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordHttpExecutionReceipt } from "@/lib/mcp/http-execution-receipt-store";
import { allTools } from "@/lib/mcp/tools";
import { TOOL_CATALOG } from "@/lib/mcp/tools/catalog";
import { juntarCatalogoComHandlers } from "@/lib/mcp/tools/catalogo-servido";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authUser = await loadAuthUser();
  if (!authUser) return fail("unauthenticated", "Auth required.", 401, { requestId });
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return fail("forbidden_tenant", "Sem organização ativa.", 403, { requestId });

  let servidas;
  try {
    servidas = juntarCatalogoComHandlers(allTools, TOOL_CATALOG);
  } catch (err) {
    // Erro de programação, não estado do usuário: servir a capacidade sem
    // rótulo empurraria o defeito para a tela do dono da clínica.
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Catálogo de capacidades inconsistente.",
      500,
      { requestId },
    );
  }

  const schemaPorNome = new Map(allTools.map((t) => [t.name, t.inputSchema]));
  const tools = servidas.map((capacidade) => ({
    ...capacidade,
    input_schema: z.toJSONSchema(z.object(schemaPorNome.get(capacidade.id) ?? {}), {
      target: "openapi-3.0",
    }),
  }));

  return ok({ tools }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = req.headers.get("x-request-id")?.trim() || randomUUID();
  try {
    const auth = await validateBearerToken(req.headers.get("authorization"));
    const body = await req.json() as { toolName?: unknown; args?: unknown; organizationId?: unknown };
    if (body.organizationId !== undefined && body.organizationId !== auth.organizationId) {
      return fail("forbidden_tenant", "Tenant mismatch.", 403, { requestId });
    }
    if (typeof body.toolName !== "string" || !body.toolName.trim() || !body.args || typeof body.args !== "object" || Array.isArray(body.args)) {
      return fail("invalid_request", "toolName and object args are required.", 400, { requestId });
    }
    let result: unknown;
    try {
      result = await invokeLumenvaCommand({
        command: { toolName: body.toolName, args: body.args as Record<string, unknown> },
        auth,
        requestId,
        supabase: createAdminClient(),
      });
    } catch (error) {
      await recordHttpExecutionReceipt({
        organizationId: auth.organizationId,
        requestId,
        toolName: body.toolName,
        actorId: auth.actor.id,
        outcome: "FAILED",
        result: { error: error instanceof Error ? error.message : String(error) },
        evidence: { source: "mcp_http", tool: body.toolName },
      });
      throw error;
    }
    await recordHttpExecutionReceipt({
      organizationId: auth.organizationId,
      requestId,
      toolName: body.toolName,
      actorId: auth.actor.id,
      outcome: "SUCCEEDED",
      result,
      evidence: { source: "mcp_http", tool: body.toolName },
    });
    return ok({ result }, { requestId });
  } catch (error) {
    if (error instanceof McpAuthError) return fail("mcp_error", error.message, error.httpStatus, { requestId });
    return fail("mcp_error", error instanceof Error ? error.message : String(error), 400, { requestId });
  }
}
