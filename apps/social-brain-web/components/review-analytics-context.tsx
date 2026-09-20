import type { AnalyticsDashboardViewModel } from '../lib/analytics/get-analytics-dashboard'

type ReviewAnalytics = Pick<AnalyticsDashboardViewModel, 'recommendations' | 'recommendationsByPlatform' | 'timeZone'>
const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube'] as const

export function ReviewAnalyticsContext({ analytics }: { analytics: ReviewAnalytics | null }) {
  return (
    <section>
      <h2>Contexto dos analytics</h2>
      {!analytics ? (
        <p>Analytics indisponíveis neste momento. A decisão de aprovação continua disponível.</p>
      ) : (
        <>
          <p>Horários apresentados no fuso <strong>{analytics.timeZone}</strong>. Estes dados são recomendações e não alteram o agendamento.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
            {analytics.recommendations.map(({ objective, label, recommendation }) => (
              <article key={objective} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12 }}>
                <strong>{label}</strong>
                {recommendation ? (
                  <p>
                    {recommendation.localWeekday} · {String(recommendation.localHour).padStart(2, '0')}:00<br />
                    {recommendation.sampleSize} posts · confiança {recommendation.confidence}
                  </p>
                ) : <p>Sem amostra suficiente.</p>}
              </article>
            ))}
          </div>

          <h3 style={{ marginTop: 24 }}>Melhor horário geral por rede</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
            {PLATFORMS.map((platform) => {
              const recommendation = analytics.recommendationsByPlatform[platform]
                .find((item) => item.objective === 'overall')?.recommendation ?? null
              return (
                <article key={platform} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
                  <strong style={{ textTransform: 'capitalize' }}>{platform}</strong>
                  {recommendation ? (
                    <p>
                      {recommendation.localWeekday} · {String(recommendation.localHour).padStart(2, '0')}:00<br />
                      {recommendation.sampleSize} posts · confiança {recommendation.confidence}
                    </p>
                  ) : <p>Sem amostra suficiente.</p>}
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
