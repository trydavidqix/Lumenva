import { requireAuth, resolveActiveOrg } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { createAuditRepository } from '@lumenva/db/audit'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const user = await requireAuth()
    const activeOrg = await resolveActiveOrg(user)
    if (!activeOrg) throw new Error("No active org")
    const workspaceId = activeOrg.orgId

    const { platform } = await params
    if (platform !== 'facebook' && platform !== 'instagram') {
      return NextResponse.redirect(new URL('/social-accounts?error=invalid_platform', request.url))
    }

    const supabase = await createClient()
    const auditRepo = createAuditRepository(supabase as any)

    // Clear credentials from social_connections and mark disconnected
    const { error: connError } = await supabase
      .from('social_connections')
      .update({
        status: 'disabled',
        access_token_ciphertext: null,
        refresh_token_ciphertext: null,
        token_expires_at: null
      })
      .eq('workspace_id', workspaceId)
      .eq('platform', platform)

    if (connError) throw connError

    // Mark related social_accounts as disconnected
    const { error: accError } = await supabase
      .from('social_accounts')
      .update({ status: 'disabled' })
      .eq('workspace_id', workspaceId)
      .eq('platform', platform)

    if (accError) throw accError

    // Log audit event
    await auditRepo.appendEvent({
      workspaceId: workspaceId,
      actorUserId: user.id,
      eventType: 'social.connection.disconnected',
      entityType: 'platform',
      entityId: platform,
      correlationId: crypto.randomUUID(),
      metadata: { platform }
    })

    return NextResponse.redirect(new URL('/app/content-os/accounts?success=disconnected', request.url))
  } catch (error) {
    console.error('Error disconnecting:', error)
    return NextResponse.redirect(new URL('/app/content-os/accounts?error=disconnect_failed', request.url))
  }
}
