#!/usr/bin/env tsx
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateBearerToken } from "@/lib/mcp/auth";
import { invokeLumenvaCommand, parseLumenvaArgs } from "@/lib/cli/lumenva";

const auth = await validateBearerToken(process.env.LUMENVA_AUTHORIZATION ?? null);
const command = parseLumenvaArgs(process.argv.slice(2));
const result = await invokeLumenvaCommand({ auth, command, requestId: randomUUID(), supabase: createAdminClient() });
process.stdout.write(`${JSON.stringify(result)}\n`);
