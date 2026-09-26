import { redirect } from 'next/navigation'

import { PublishStatusCard } from '../../../components/publish-status-card'
import { OwnerAuthError } from '../../../lib/auth/require-owner'
import { requireSupabaseOwner } from '../../../lib/auth/supabase-runtime'
import { listPublishingStatus } from '../../../lib/publishing/status-data'

export const dynamic = 'force-dynamic'

export default async function PublishingPage() {
  let owner

  try {
    owner = await requireSupabaseOwner()
  } catch (error) {
    if (error instanceof OwnerAuthError) redirect('/login')
    throw error
  }

  const items = await listPublishingStatus(owner.workspaceId)

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 980, margin: '64px auto', padding: 24 }}>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
        Social Brain
      </p>
      <h1>Estado das publicações</h1>
      <p>Cada rede é acompanhada separadamente. Uma falha não desfaz publicações que já tiveram sucesso.</p>

      {items.length === 0 ? (
        <p style={{ marginTop: 32 }}>Ainda não existem jobs de publicação.</p>
      ) : (
        <div style={{ display: 'grid', gap: 14, marginTop: 28 }}>
          {items.map((item) => <PublishStatusCard key={item.id} item={item} />)}
        </div>
      )}
    </main>
  )
}
