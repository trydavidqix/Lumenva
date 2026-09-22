import { requireAuth, resolveActiveOrg } from '@/lib/auth/server'
import { oauth } from '@lumenva/integration-meta'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const activeOrg = await resolveActiveOrg(user)
    if (!activeOrg) throw new Error("No active org")
    const state = crypto.randomBytes(32).toString('hex')
    
    const cookieStore = await cookies()
    cookieStore.set('ig_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/integrations/meta/instagram/callback',
      maxAge: 10 * 60, // 10 minutes
    })
    cookieStore.set('ig_oauth_workspace', activeOrg.orgId, {
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
    if (error.message?.includes('auth') || error.message?.includes('org')) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
