import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { createSupabaseServerClient } from '../../../lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()

  if (data?.claims) {
    await supabase.auth.signOut()
  }

  revalidatePath('/', 'layout')
  return NextResponse.redirect(new URL('/login', request.url), { status: 302 })
}
