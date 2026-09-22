import { createAuditRepository } from '@lumenva/db/audit'
import { createSupabaseSocialConnectionRepository, createSupabaseSocialAccountStore } from '@lumenva/db/social'
import { oauth, accounts } from '@lumenva/integration-meta'
import { createClient } from '@/lib/supabase/server'
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
      return NextResponse.redirect(new URL('/app/content-os/accounts?error=oauth_denied', request.url))
    }
    if (!code || !state) {
      return NextResponse.redirect(new URL('/app/content-os/accounts?error=oauth_invalid_request', request.url))
    }

    const cookieStore = await cookies()
    const expectedState = cookieStore.get('fb_oauth_state')?.value
    const workspaceId = cookieStore.get('fb_oauth_workspace')?.value

    if (!expectedState || state !== expectedState || !workspaceId) {
      return NextResponse.redirect(new URL('/app/content-os/accounts?error=oauth_state_invalid', request.url))
    }

    // Clear cookies
    cookieStore.delete('fb_oauth_state')
    cookieStore.delete('fb_oauth_workspace')

    const clientId = process.env.FACEBOOK_CLIENT_ID
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('FACEBOOK_CLIENT_ID or FACEBOOK_CLIENT_SECRET not set')
    }

    const redirectUri = `${url.origin}/api/integrations/meta/facebook/callback`

    // Exchange for short lived token
    const shortTokenData = await oauth.exchangeCode({
      clientId,
      clientSecret,
      redirectUri,
      code,
    })

    // Upgrade to long lived token
    const longTokenData = await oauth.toLongLived({
      clientId,
      clientSecret,
      shortToken: shortTokenData.accessToken,
      userId: shortTokenData.userId,
    })

    const userAccessToken = longTokenData.accessToken;

    // Discover accounts (Pages and linked Instagram business accounts)
    const discoveredAccounts = await accounts.discoverAccounts(userAccessToken);
    
    if (discoveredAccounts.length === 0) {
       return NextResponse.redirect(new URL('/app/content-os/accounts?error=no_pages_found', request.url))
    }

    const supabase = await createClient()
    const connectionRepo = createSupabaseSocialConnectionRepository(supabase as any)
    const accountStore = createSupabaseSocialAccountStore(supabase as any)
    const auditRepo = createAuditRepository(supabase as any)

    for (const acc of discoveredAccounts) {
      const expiresAt = longTokenData.expiresAt ? new Date(longTokenData.expiresAt * 1000) : null;
      
      // Store connection
      await connectionRepo.upsertConnection({
        workspaceId,
        provider: 'meta',
        platform: acc.platform,
        providerAccountId: acc.pageId!, // using pageId as providerAccountId since token belongs to page
        externalAccountId: acc.externalId,
        status: 'active',
        tokenExpiresAt: expiresAt,
        scopes: [], // We can't easily get exactly what was granted per page, but we know what we asked for.
        accessToken: acc.pageAccessToken,
        refreshToken: null,
      })

      // Store account
      await accountStore.upsert([{
        workspace_id: workspaceId,
        platform: acc.platform,
        external_account_id: acc.externalId,
        brightbean_account_id: acc.externalId, // Same here, assuming mapping is 1:1 for simplicity
        display_name: acc.name,
        status: 'active',
        metadata: { provider: 'meta', page_id: acc.pageId },
        updated_at: new Date().toISOString(),
      }], 'workspace_id,platform,brightbean_account_id')

      await auditRepo.appendEvent({
        workspaceId,
        actorUserId: null,
        eventType: 'social_account_connected',
        entityType: 'social_account',
        entityId: acc.externalId,
        correlationId: crypto.randomUUID(),
        metadata: {
          platform: acc.platform,
          provider: 'meta',
          name: acc.name
        },
      })
    }

    return NextResponse.redirect(new URL('/app/content-os/accounts?success=true', request.url))
  } catch (error: any) {
    console.error('Error in Facebook callback:', error)
    return NextResponse.redirect(new URL('/app/content-os/accounts?error=oauth_exchange_failed', request.url))
  }
}
