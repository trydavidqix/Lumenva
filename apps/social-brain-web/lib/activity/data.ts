import { createSupabaseServerClient } from '../supabase/server'

export type RecentActivityItem = {
  id: string
  eventType: string
  entityType: string | null
  entityId: string | null
  createdAt: string
}

export async function listRecentActivity(workspaceId: string): Promise<RecentActivityItem[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('audit_events')
    .select('id,event_type,entity_type,entity_id,created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error('Failed to load recent activity')
  return (data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at,
  }))
}
