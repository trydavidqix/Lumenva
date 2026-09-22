import { requireSupabaseOwner } from '../../../../../../lib/auth/supabase-runtime'
import { oauth } from '@lumenva/integration-meta'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: Request) {
  try {
    const owner = await requireSupabaseOwner()
    const state = crypto.randomBytes(32).toString('hex')
    
    const cookieStore = await cookies()
    cookieStore.set('ig_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/integrations/meta/instagram/callback',
      maxAge: 10 * 60, // 10 minutes
    })
    cookieStore.set('ig_oauth_workspace', owner.workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/integrations/meta/instagram/callback',
      maxAge: 10 * 60,
    })

    const clientId = process.env.INSTAGRAM_CLIENT_ID
    if (!clientId) throw new Error('INSTAGRAM_CLIENT_ID is not set')
    
    const origin = new URL(request.url).origin
    const redirectUri = `${origin}/api/integrations/meta/instagram/callback`

    const authUrl = oauth.buildAuthUrl({
      clientId,
      redirectUri,
      state,
    })

    return NextResponse.redirect(authUrl)
  } catch (error: any) {
    console.error('Error starting Instagram OAuth:', error)
    if (error.name === 'OwnerAuthError') {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
