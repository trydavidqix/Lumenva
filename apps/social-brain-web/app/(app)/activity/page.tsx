import { redirect } from 'next/navigation'

import { OwnerAuthError } from '../../../lib/auth/require-owner'
import { requireSupabaseOwner } from '../../../lib/auth/supabase-runtime'
import { listRecentActivity } from '../../../lib/activity/data'

export const dynamic = 'force-dynamic'

export default async function RecentActivityPage() {
  let owner
  try {
    owner = await requireSupabaseOwner()
  } catch (error) {
    if (error instanceof OwnerAuthError) redirect('/login')
    throw error
  }

  const items = await listRecentActivity(owner.workspaceId)

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '48px auto', padding: 24 }}>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>Auditoria</p>
      <h1>Recent Activity</h1>
      <p>Eventos seguros do workspace. Payloads brutos, tokens e segredos não são exibidos.</p>
      <ol>
        {items.map((item) => (
          <li key={item.id} style={{ marginBottom: 16 }}>
            <strong>{item.eventType}</strong>
            {item.entityType ? ` · ${item.entityType}` : ''}
            {item.entityId ? ` · ${item.entityId}` : ''}
            <div style={{ fontSize: 13, opacity: 0.7 }}>{new Date(item.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ol>
    </main>
  )
}
