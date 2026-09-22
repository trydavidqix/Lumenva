import { createAuditRepository } from '@lumenva/db/audit'
import { createSupabaseSocialAccountStore } from '@lumenva/db/social'
import { createSupabaseSocialConnectionRepository } from '@lumenva/db/social/connections'
import { oauth, igRead } from '@lumenva/integration-meta'
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const errorParam = url.searchParams.get('error')

    if (errorParam) {
      return NextResponse.redirect(new URL('/social-accounts?error=oauth_denied', request.url))
    }
    if (!code || !state) {
      return NextResponse.redirect(new URL('/social-accounts?error=oauth_invalid_request', request.url))
    }

    const cookieStore = await cookies()
    const expectedState = cookieStore.get('ig_oauth_state')?.value
    const workspaceId = cookieStore.get('ig_oauth_workspace')?.value

    if (!expectedState || state !== expectedState || !workspaceId) {
      return NextResponse.redirect(new URL('/social-accounts?error=oauth_state_invalid', request.url))
    }

    // Clear cookies
    cookieStore.delete('ig_oauth_state')
    cookieStore.delete('ig_oauth_workspace')

    const clientId = process.env.INSTAGRAM_CLIENT_ID
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('INSTAGRAM_CLIENT_ID or INSTAGRAM_CLIENT_SECRET not set')
    }

    const redirectUri = `${url.origin}/api/integrations/meta/instagram/callback`

    // Exchange for short lived token
    const shortTokens = await oauth.exchangeCode({
      clientId,
      clientSecret,
      redirectUri,
      code,
    })

    // Upgrade to long lived token
    const tokens = await oauth.toLongLived({
      clientId,
      clientSecret,
      shortToken: shortTokens.accessToken,
      userId: shortTokens.userId,
    })

    // Verify permissions
    const perms = await igRead.getInstagramPermissions(tokens.accessToken)
    const scopes = perms.filter((p: { permission: string; status: string }) => p.status === 'granted').map((p: { permission: string; status: string }) => p.permission)
    const requiredScopes = ['instagram_business_basic', 'instagram_business_content_publish']
    const hasRequired = requiredScopes.every(scope => scopes.includes(scope))

    if (!hasRequired) {
      return NextResponse.redirect(new URL('/social-accounts?error=permissions_missing', request.url))
    }

    // Fetch profile identity
    const profileUrl = new URL(`https://graph.instagram.com/v22.0/${tokens.userId}`)
    profileUrl.searchParams.set('fields', 'id,username,name,profile_picture_url')
    profileUrl.searchParams.set('access_token', tokens.accessToken)
    
    const profileRes = await fetch(profileUrl.toString())
    if (!profileRes.ok) {
      throw new Error('Failed to fetch Instagram profile')
    }
    const profile = await profileRes.json()
    const displayName = profile.name || profile.username || tokens.userId

    const supabase = await createSupabaseServerClient()

    const connectionRepo = createSupabaseSocialConnectionRepository(supabase as any)
    await connectionRepo.upsertConnection({
      workspaceId,
      provider: 'meta',
      platform: 'instagram',
      providerAccountId: tokens.userId,
      externalAccountId: tokens.userId,
      status: 'active',
      tokenExpiresAt: new Date(tokens.expiresAt * 1000),
      scopes: scopes,
      accessToken: tokens.accessToken,
      refreshToken: null,
    })

    const accountStore = createSupabaseSocialAccountStore(supabase as any)
    await accountStore.upsert([{
      workspace_id: workspaceId,
      platform: 'instagram',
      external_account_id: tokens.userId,
      brightbean_account_id: tokens.userId,
      display_name: displayName,
      status: 'active',
      metadata: { provider: 'meta', username: profile.username, profile_picture_url: profile.profile_picture_url },
      updated_at: new Date().toISOString(),
    }], 'workspace_id,platform,brightbean_account_id')

    const auditRepo = createAuditRepository(supabase as any)
    await auditRepo.appendEvent({
      workspaceId,
      actorUserId: null,
      eventType: 'social_account_connected',
      entityType: 'social_account',
      entityId: tokens.userId,
      correlationId: crypto.randomUUID(),
      metadata: {
        platform: 'instagram',
        provider: 'meta',
      },
    })

    return NextResponse.redirect(new URL('/social-accounts?success=true', request.url))
  } catch (error: any) {
    console.error('Error in Instagram callback:', error)
    return NextResponse.redirect(new URL('/social-accounts?error=oauth_exchange_failed', request.url))
  }
}
