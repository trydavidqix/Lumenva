export function KpiCard({
  label,
  value,
  deltaPercent,
}: {
  label: string
  value: number | null
  deltaPercent: number | null
}) {
  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{formatValue(value)}</div>
      {deltaPercent !== null ? (
        <div style={{ fontSize: 13, marginTop: 6 }}>{formatDelta(deltaPercent)} vs. período anterior</div>
      ) : (
        <div style={{ fontSize: 13, marginTop: 6, opacity: 0.6 }}>Comparação indisponível</div>
      )}
    </article>
  )
}

function formatValue(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)
}

function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}
