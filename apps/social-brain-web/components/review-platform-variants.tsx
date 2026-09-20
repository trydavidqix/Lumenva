import type { ApprovalReviewData } from '../lib/approvals/review-data'

export function ReviewPlatformVariants({ variants }: { variants: ApprovalReviewData['snapshot']['variants'] }) {
  return (
    <section>
      <h2>Variantes por rede</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
        {variants.map((variant) => (
          <article key={variant.platform} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16 }}>
            <strong>{variant.platform}</strong>
            {variant.title ? <p><b>Título:</b> {variant.title}</p> : null}
            <p style={{ whiteSpace: 'pre-wrap' }}>{variant.caption}</p>
            {variant.hashtags.length > 0 ? <p>{variant.hashtags.map((tag) => `#${tag}`).join(' ')}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
