import type { AnalyticsDashboardViewModel } from '../../../../lib/analytics/get-analytics-dashboard'

type RecommendationItem = AnalyticsDashboardViewModel['recommendations'][number]

export function BestTimeCard({ item }: { item: RecommendationItem }) {
  const recommendation = item.recommendation
  const explanation = item.explanation

  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{item.label}</div>
      {recommendation ? (
        <>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
            {recommendation.localWeekday} · {String(recommendation.localHour).padStart(2, '0')}:00
          </div>
          <p style={{ marginBottom: 6 }}>
            {recommendation.sampleSize} posts · confiança <strong>{recommendation.confidence}</strong>
          </p>
          {recommendation.comparisonMetrics.upliftPercent !== null ? (
            <p>{formatDelta(recommendation.comparisonMetrics.upliftPercent)} vs. mediana comparativa.</p>
          ) : null}
          {explanation?.facts.map((fact) => <p key={fact}><strong>Fato:</strong> {fact}</p>)}
          {explanation?.hypotheses.map((hypothesis) => <p key={hypothesis}><strong>Possível motivo:</strong> {hypothesis}</p>)}
          {explanation?.caveats.map((caveat) => <p key={caveat} style={{ fontSize: 13, opacity: 0.7 }}>{caveat}</p>)}
          <details>
            <summary>Ver evidências</summary>
            <code style={{ fontSize: 12 }}>{recommendation.evidenceSnapshotIds.join(', ')}</code>
          </details>
        </>
      ) : (
        <p>Dados insuficientes para recomendar este horário com segurança.</p>
      )}
    </article>
  )
}

function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}
