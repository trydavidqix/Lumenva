'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { OwnerSessionError } from '../../lib/auth/owner-session'
import { loginSupabaseOwner } from '../../lib/auth/supabase-runtime'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/login?error=invalid')
  }

  try {
    await loginSupabaseOwner(email, password)
  } catch (error) {
    if (error instanceof OwnerSessionError) {
      redirect('/login?error=invalid')
    }

    throw error
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
