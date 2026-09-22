import { requireSupabaseOwner } from '../../../../../../lib/auth/supabase-runtime'
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params
    if (platform !== 'facebook' && platform !== 'instagram') {
      return NextResponse.redirect(new URL('/social-accounts?error=invalid_platform', request.url))
    }

    const owner = await requireSupabaseOwner()
    const supabase = await createSupabaseServerClient()

    // Find the existing connection ID for this platform to pass via cookie
    const { data: conn } = await supabase
      .from('social_connections')
      .select('id')
      .eq('workspace_id', owner.workspaceId)
      .eq('platform', platform)
      .limit(1)
      .maybeSingle()

    if (conn) {
      const cookieStore = await cookies()
      cookieStore.set(`${platform}_oauth_reconnect_id`, conn.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: `/api/integrations/meta/${platform}/callback`,
        maxAge: 10 * 60, // 10 minutes
      })
    }

    // Redirect to the start flow
    return NextResponse.redirect(new URL(`/api/integrations/meta/${platform}/start`, request.url))
  } catch (error) {
    console.error('Error in reconnect:', error)
    return NextResponse.redirect(new URL('/social-accounts?error=reconnect_failed', request.url))
  }
}
