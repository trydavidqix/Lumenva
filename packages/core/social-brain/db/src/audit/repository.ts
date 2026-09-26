import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '../types'

export type AgentRunStatus = 'running' | 'succeeded' | 'failed'

export type AgentRunStart = {
  workspaceId: string
  toolName: string
  correlationId: string
  safeInput: Json
  startedAt: string
}

export type AgentRunFinish = {
  status: Exclude<AgentRunStatus, 'running'>
  safeOutput: Json | null
  errorCode: string | null
  completedAt: string
}

export type AuditEventInput = {
  workspaceId: string
  actorUserId: string | null
  eventType: string
  entityType?: string | null
  entityId?: string | null
  correlationId: string
  metadata?: Json
}

export type AuditRepository = {
  startAgentRun(input: AgentRunStart): Promise<{ id: string }>
  finishAgentRun(id: string, input: AgentRunFinish): Promise<void>
  appendEvent(input: AuditEventInput): Promise<{ id: string }>
}

export function createAuditRepository(client: SupabaseClient<Database>): AuditRepository {
  const auditClient = client as unknown as SupabaseClient<any>

  return {
    async startAgentRun(input) {
      const { data, error } = await auditClient
        .from('agent_runs')
        .insert({
          workspace_id: input.workspaceId,
          tool_name: input.toolName,
          correlation_id: input.correlationId,
          safe_input: input.safeInput,
          safe_output: null,
          status: 'running',
          error_code: null,
          started_at: input.startedAt,
          completed_at: null,
        })
        .select('id')
        .single()

      if (error || !data) throw new Error('Failed to start agent run')
      return data as { id: string }
    },

    async finishAgentRun(id, input) {
      const { error } = await auditClient
        .from('agent_runs')
        .update({
          status: input.status,
          safe_output: input.safeOutput,
          error_code: input.errorCode,
          completed_at: input.completedAt,
        })
        .eq('id', id)

      if (error) throw new Error('Failed to finish agent run')
    },

    async appendEvent(input) {
      const { data, error } = await auditClient
        .from('audit_events')
        .insert({
          workspace_id: input.workspaceId,
          actor_user_id: input.actorUserId,
          event_type: input.eventType,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          correlation_id: input.correlationId,
          metadata: input.metadata ?? {},
        })
        .select('id')
        .single()

      if (error || !data) throw new Error('Failed to append audit event')
      return data as { id: string }
    },
  }
}
