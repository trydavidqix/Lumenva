import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireAuth, resolveActiveOrg } from '@/lib/auth/server'
import {
  getSocialAccountsPageModel,
  type SocialAccountConnectionState,
} from '@/lib/social-accounts/accounts-data'
import { syncSocialAccountsForOwner } from '@/lib/social-accounts/sync-social-accounts'

export const dynamic = 'force-dynamic'

const STATE_COPY: Record<SocialAccountConnectionState, { status: string; action: string }> = {
  disconnected: { status: 'Não conectado', action: 'Conectar' },
  connected: { status: 'Conectado', action: 'Gerir contas' },
  reconnect: { status: 'Reconexão necessária', action: 'Reconectar' },
  unavailable: { status: 'Indisponível', action: 'Gerir conexão' },
}

export default async function SocialAccountsPage() {
  const user = await requireAuth()
  const activeOrg = await resolveActiveOrg(user)
  if (!activeOrg) redirect('/onboarding')
  const workspaceId = activeOrg.orgId

  const syncResult = await syncSocialAccountsForOwner({
    workspaceId: workspaceId,
    env: process.env,
  })
  const model = await getSocialAccountsPageModel({
    env: process.env,
    ownerWorkspaceId: workspaceId,
    accountsOverride: syncResult.ok ? syncResult.accounts : undefined,
    syncError: syncResult.ok ? null : syncResult.message,
  })
  const notice = syncResult.message ?? model.error

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 980, margin: '48px auto', padding: 24 }}>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
        Integrações
      </p>
      <h1>Contas sociais</h1>
      <p style={{ maxWidth: 760 }}>
        Conecte e acompanhe as contas usadas pelo Social Brain. A autorização das redes acontece no
        BrightBean, enquanto o Social Brain mantém apenas o vínculo necessário para analytics,
        aprovação e publicação.
      </p>

      <nav aria-label="Navegação" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '20px 0 28px' }}>
        <Link href="/dashboard">Início</Link>
        <Link href="/analytics">Analytics</Link>
        <Link href="/approvals">Aprovações</Link>
        <Link href="/publishing">Publicações</Link>
        <Link href="/activity">Atividade</Link>
      </nav>

      {notice ? (
        <div role="status" style={{ border: '1px solid #d6a700', borderRadius: 12, padding: 14, marginBottom: 20 }}>
          {notice}
        </div>
      ) : null}

      <section
        aria-label="Redes sociais"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}
      >
        {model.platforms.map((item) => {
          const copy = STATE_COPY[item.state]
          const canManage = Boolean(model.connectionUrl)

          return (
            <article key={item.platform} style={{ border: '1px solid #ddd', borderRadius: 14, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>{item.label}</h2>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{copy.status}</span>
              </div>

              {item.accounts.length > 0 ? (
                <ul style={{ paddingLeft: 20, minHeight: 42 }}>
                  {item.accounts.map((account) => (
                    <li key={account.providerAccountId}>
                      {account.displayName ?? account.providerAccountId}
                      {account.status !== 'active' ? ' · precisa de atenção' : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ minHeight: 42, opacity: 0.75 }}>
                  {item.state === 'unavailable'
                    ? 'O estado desta rede não pode ser consultado agora.'
                    : 'Nenhuma conta conectada.'}
                </p>
              )}

              {canManage ? (
                <a href={model.connectionUrl!} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                  {copy.action}
                </a>
              ) : (
                <span style={{ opacity: 0.65 }}>{copy.action}</span>
              )}
            </article>
          )
        })}
      </section>

      <section style={{ marginTop: 28, borderTop: '1px solid #ddd', paddingTop: 20 }}>
        <h2 style={{ fontSize: 18 }}>Depois de conectar</h2>
        <p>
          Termine a autorização no BrightBean e volte para esta página. Ao recarregar, o Social Brain
          sincroniza novamente as contas do seu workspace.
        </p>
        <Link href="/app/content-os/accounts">Atualizar estado das contas</Link>
      </section>
    </main>
  )
}
