import Link from 'next/link'
import { redirect } from 'next/navigation'

import { OwnerAuthError } from '../../../lib/auth/require-owner'
import { requireSupabaseOwner } from '../../../lib/auth/supabase-runtime'
import { listApprovalQueue } from '../../../lib/approvals/review-data'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  let owner

  try {
    owner = await requireSupabaseOwner()
  } catch (error) {
    if (error instanceof OwnerAuthError) redirect('/login')
    throw error
  }

  const items = await listApprovalQueue(owner.workspaceId)

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '64px auto', padding: 24 }}>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
        Social Brain
      </p>
      <h1>Fila de aprovação</h1>
      <p>Conteúdo aguardando uma decisão explícita do owner.</p>

      {items.length === 0 ? (
        <p style={{ marginTop: 32 }}>Não há conteúdo pendente neste momento.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 28 }}>
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/approvals/${item.id}`}
              style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, color: 'inherit', textDecoration: 'none' }}
            >
              <strong>{item.topic}</strong>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                {item.proposedPublishMode === 'schedule' && item.proposedScheduledFor
                  ? `Agendado para ${new Date(item.proposedScheduledFor).toLocaleString('pt-PT')}`
                  : 'Publicação imediata após aprovação'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
