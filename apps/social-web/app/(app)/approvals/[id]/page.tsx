import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ContentReview } from '../../../../components/content-review'
import { getAnalyticsDashboard } from '../../../../lib/analytics/get-analytics-dashboard'
import { OwnerAuthError } from '../../../../lib/auth/require-owner'
import { requireSupabaseOwner } from '../../../../lib/auth/supabase-runtime'
import { loadApprovalReview } from '../../../../lib/approvals/review-data'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ApprovalReviewPage({ params }: PageProps) {
  let owner

  try {
    owner = await requireSupabaseOwner()
  } catch (error) {
    if (error instanceof OwnerAuthError) redirect('/login')
    throw error
  }

  const { id } = await params
  const review = await loadApprovalReview(owner.workspaceId, id)
  if (!review) notFound()

  const analytics = await getAnalyticsDashboard(owner.workspaceId, '30d').catch(() => null)
  const reviewAnalytics = analytics
    ? {
        recommendations: analytics.recommendations,
        recommendationsByPlatform: analytics.recommendationsByPlatform,
        timeZone: analytics.timeZone,
      }
    : null

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 1000, margin: '48px auto', padding: 24 }}>
      <Link href="/approvals">← Voltar à fila</Link>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12, marginTop: 28 }}>
        Revisão explícita
      </p>
      <h1>{review.topic}</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>Estado: {review.status}</p>
      <ContentReview review={review} analytics={reviewAnalytics} />
    </main>
  )
}
