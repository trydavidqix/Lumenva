import type { Json } from '@lumenva/db/types'

import type { McpApplicationContext } from '../context'

const SECRET_KEY = /(authorization|password|secret|token|api[-_]?key|cookie)/i

export function redactSecrets(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (typeof value !== 'object') return String(value)
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SECRET_KEY.test(key) ? '[REDACTED]' : redactSecrets(nested),
    ]),
  ) as Json
}

export async function runInstrumentedTool<T>(
  context: McpApplicationContext,
  toolName: string,
  input: unknown,
  handler: () => Promise<T>,
): Promise<T> {
  const correlationId = crypto.randomUUID()
  const startedAt = new Date().toISOString()
  const run = await context.audit.startAgentRun({
    workspaceId: context.workspaceId,
    toolName,
    correlationId,
    safeInput: redactSecrets(input),
    startedAt,
  })

  try {
    const output = await handler()
    await finalizeSuccessBestEffort(context, run.id, toolName, correlationId, output)
    return output
  } catch (error) {
    await finalizeFailureBestEffort(context, run.id, toolName, correlationId, error)
    throw error
  }
}

async function finalizeSuccessBestEffort(
  context: McpApplicationContext,
  runId: string,
  toolName: string,
  correlationId: string,
  output: unknown,
): Promise<void> {
  try {
    await context.audit.finishAgentRun(runId, {
      status: 'succeeded',
      safeOutput: redactSecrets(output),
      errorCode: null,
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    logAuditFailure('finish success', error)
  }
  try {
    await context.audit.appendEvent({
      workspaceId: context.workspaceId,
      actorUserId: context.ownerUserId,
      eventType: 'mcp.tool.succeeded',
      entityType: 'agent_run',
      entityId: runId,
      correlationId,
      metadata: { toolName },
    })
  } catch (error) {
    logAuditFailure('append success event', error)
  }
}

async function finalizeFailureBestEffort(
  context: McpApplicationContext,
  runId: string,
  toolName: string,
  correlationId: string,
  originalError: unknown,
): Promise<void> {
  const errorCode = readErrorCode(originalError)
  try {
    await context.audit.finishAgentRun(runId, {
      status: 'failed',
      safeOutput: null,
      errorCode,
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    logAuditFailure('finish failure', error)
  }
  try {
    await context.audit.appendEvent({
      workspaceId: context.workspaceId,
      actorUserId: context.ownerUserId,
      eventType: 'mcp.tool.failed',
      entityType: 'agent_run',
      entityId: runId,
      correlationId,
      metadata: { toolName, errorCode },
    })
  } catch (error) {
    logAuditFailure('append failure event', error)
  }
}

function logAuditFailure(stage: string, error: unknown): void {
  console.error(`MCP audit ${stage} failed`, error instanceof Error ? error.message : 'unknown error')
}

function readErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code
  return 'tool_failed'
}
