import type { ApprovalReviewData } from '../lib/approvals/review-data'

type ReviewMedia = ApprovalReviewData['media']

export function ReviewVideo({ media }: { media: ReviewMedia }) {
  return (
    <section>
      <h2>Vídeo</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {media.length === 0 ? <p>Nenhum vídeo ligado a este conteúdo.</p> : null}
        {media.map((asset) =>
          asset.signedUrl ? (
            <video
              key={asset.id}
              src={asset.signedUrl}
              controls
              preload="metadata"
              style={{ width: '100%', maxWidth: 520, borderRadius: 12 }}
            />
          ) : (
            <p key={asset.id}>Pré-visualização do vídeo indisponível.</p>
          ),
        )}
      </div>
    </section>
  )
}
