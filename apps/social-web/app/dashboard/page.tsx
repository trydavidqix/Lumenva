import Link from 'next/link'
import { redirect } from 'next/navigation'

import { OwnerAuthError } from '../../lib/auth/require-owner'
import { requireSupabaseOwner } from '../../lib/auth/supabase-runtime'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let ownerContext

  try {
    ownerContext = await requireSupabaseOwner()
  } catch (error) {
    if (error instanceof OwnerAuthError) {
      redirect('/login')
    }

    throw error
  }

  return (
    <main
      style={{
        fontFamily: 'sans-serif',
        maxWidth: 760,
        margin: '80px auto',
        padding: 24,
      }}
    >
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
        Owner workspace
      </p>
      <h1>Lumenva Social Brain</h1>
      <p>Foundation autenticada e ligada ao Supabase.</p>
      <p style={{ fontSize: 13, opacity: 0.7 }}>Workspace: {ownerContext.workspaceId}</p>

      <nav aria-label="Áreas do workspace" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 24 }}>
        <Link href="/social-accounts">Contas sociais</Link>
        <Link href="/analytics">Analytics</Link>
        <Link href="/approvals">Aprovações</Link>
        <Link href="/publishing">Publicações</Link>
        <Link href="/activity">Atividade</Link>
      </nav>

      <form action="/auth/signout" method="post" style={{ marginTop: 28 }}>
        <button type="submit" style={{ padding: 10, cursor: 'pointer' }}>
          Terminar sessão
        </button>
      </form>
    </main>
  )
}
