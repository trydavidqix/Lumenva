import { entitlementRequestSchema, readOrganizationEntitlements, authorizeModuleForContext, decisionPayload } from "@/lib/entitlements/adapter";
import type { McpToolDefinition } from "../types";

const inputSchema = entitlementRequestSchema.shape;

export const crmAuthorizeModule: McpToolDefinition<typeof inputSchema> = {
  name: "crm_authorize_module",
  description: "Avalia se um módulo está autorizado para a organização e o actor atual, sem executar efeitos laterais.",
  inputSchema,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const tenant = await readOrganizationEntitlements(ctx.supabase, ctx.organizationId);
    return decisionPayload(authorizeModuleForContext({
      requestId: ctx.requestId,
      organizationId: ctx.organizationId,
      actorId: ctx.actor.id,
      role: ctx.role,
      ...tenant,
      request: input,
    }));
  },
};
