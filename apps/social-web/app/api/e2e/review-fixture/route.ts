import { NextResponse } from 'next/server'

import { snapshotHash, type ReviewSnapshot } from '@lumenva/core'

import { OwnerAuthError } from '../../../../lib/auth/require-owner'
import { requireSupabaseOwner } from '../../../../lib/auth/supabase-runtime'
import { createSupabaseServerClient } from '../../../../lib/supabase/server'

const FIXTURE_TOPIC = '__E2E Review UX 2.0__'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  let owner
  try {
    owner = await requireSupabaseOwner()
  } catch (error) {
    if (error instanceof OwnerAuthError) {
      return NextResponse.json({ ok: false, code: 'owner_auth_required' }, { status: 401 })
    }
    throw error
  }

  const supabase = await createSupabaseServerClient()
  const client = supabase as any

  await client
    .from('content_items')
    .delete()
    .eq('workspace_id', owner.workspaceId)
    .eq('topic', FIXTURE_TOPIC)

  const id = crypto.randomUUID()
  const snapshot: ReviewSnapshot = {
    contentId: id,
    script: 'Fixture E2E inerte para validar a experiência de revisão V1.1.',
    mediaAssetIds: [],
    variants: [
      { platform: 'instagram', title: 'Fixture Instagram', caption: 'Fixture E2E', hashtags: ['e2e'] },
      { platform: 'facebook', title: 'Fixture Facebook', caption: 'Fixture E2E', hashtags: ['e2e'] },
      { platform: 'tiktok', title: 'Fixture TikTok', caption: 'Fixture E2E', hashtags: ['e2e'] },
      { platform: 'youtube', title: 'Fixture YouTube', caption: 'Fixture E2E', hashtags: ['e2e'] },
    ],
    targetAccountIds: [],
    scheduledFor: null,
    publishMode: 'now',
  }

  const { error } = await client.from('content_items').insert({
    id,
    workspace_id: owner.workspaceId,
    topic: FIXTURE_TOPIC,
    objective: 'E2E only',
    hook: 'E2E fixture',
    script: snapshot.script,
    status: 'PENDING_APPROVAL',
    proposed_publish_mode: 'now',
    proposed_scheduled_for: null,
    review_snapshot_json: snapshot,
    review_snapshot_hash: snapshotHash(snapshot),
  })

  if (error) {
    return NextResponse.json({ ok: false, code: 'fixture_create_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id })
}

export async function DELETE() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  let owner
  try {
    owner = await requireSupabaseOwner()
  } catch (error) {
    if (error instanceof OwnerAuthError) {
      return NextResponse.json({ ok: false, code: 'owner_auth_required' }, { status: 401 })
    }
    throw error
  }

  const supabase = await createSupabaseServerClient()
  const client = supabase as any
  const { error } = await client
    .from('content_items')
    .delete()
    .eq('workspace_id', owner.workspaceId)
    .eq('topic', FIXTURE_TOPIC)

  if (error) {
    return NextResponse.json({ ok: false, code: 'fixture_cleanup_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
