'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { AnalyticsDashboardViewModel } from '../lib/analytics/get-analytics-dashboard'
import type { ApprovalReviewData } from '../lib/approvals/review-data'
import { ReviewAnalyticsContext } from './review-analytics-context'
import { ReviewPlatformVariants } from './review-platform-variants'
import { ReviewScheduleContext } from './review-schedule-context'
import { ReviewVideo } from './review-video'

type ReviewAnalytics = Pick<AnalyticsDashboardViewModel, 'recommendations' | 'recommendationsByPlatform' | 'timeZone'>

export function ContentReview({ review, analytics = null }: { review: ApprovalReviewData; analytics?: ReviewAnalytics | null }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bestOverall = analytics?.recommendations.find((item) => item.objective === 'overall')?.recommendation ?? null

  async function submit(kind: 'approve' | 'reject') {
    setBusy(kind)
    setError(null)

    try {
      const init: RequestInit = { method: 'POST' }
      if (kind === 'reject') {
        init.headers = { 'content-type': 'application/json' }
        init.body = JSON.stringify({ reason })
      }

      const response = await fetch(`/api/approvals/${review.id}/${kind}`, init)
      const result = (await response.json()) as { ok: boolean; code?: string }

      if (!response.ok || !result.ok) {
        setError(result.code ?? 'approval_action_failed')
        return
      }

      router.push('/approvals')
      router.refresh()
    } catch {
      setError('approval_action_failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <article style={{ display: 'grid', gap: 24 }}>
      <section>
        <h2>Script</h2>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{review.snapshot.script}</p>
      </section>

      <ReviewVideo media={review.media} />
      <ReviewPlatformVariants variants={review.snapshot.variants} />

      <section>
        <h2>Contas de destino</h2>
        <ul>
          {review.accounts.map((account) => (
            <li key={account.id}>
              {account.platform}: {account.displayName ?? 'Conta ligada'}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Publicação</h2>
        <p>Modo: {review.snapshot.publishMode === 'schedule' ? 'Agendada' : 'Imediata após aprovação'}</p>
        {review.snapshot.scheduledFor ? <p>Horário: {new Date(review.snapshot.scheduledFor).toLocaleString()}</p> : null}
        {review.scheduleRationale ? <p>Motivo do horário: {review.scheduleRationale}</p> : null}
      </section>

      {analytics ? (
        <ReviewScheduleContext
          scheduledFor={review.snapshot.scheduledFor}
          timeZone={analytics.timeZone}
          bestOverall={bestOverall}
        />
      ) : null}
      <ReviewAnalyticsContext analytics={analytics} />

      <section style={{ borderTop: '1px solid #ddd', paddingTop: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void submit('approve')}
            style={{ padding: '10px 16px', cursor: 'pointer' }}
          >
            {busy === 'approve' ? 'A aprovar…' : 'Aprovar'}
          </button>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gap: 8, maxWidth: 520 }}>
          <label htmlFor="rejection-reason">Motivo da rejeição</label>
          <textarea
            id="rejection-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
          <button
            type="button"
            disabled={busy !== null || reason.trim().length === 0}
            onClick={() => void submit('reject')}
            style={{ width: 'fit-content', padding: '10px 16px', cursor: 'pointer' }}
          >
            {busy === 'reject' ? 'A rejeitar…' : 'Rejeitar'}
          </button>
        </div>

        {error ? <p role="alert">Não foi possível concluir: {error}</p> : null}
      </section>
    </article>
  )
}
