import type { TimeSlotHeatmapCell } from '@lumenva/core'

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

export function Heatmap({ cells }: { cells: TimeSlotHeatmapCell[] }) {
  if (cells.length === 0) return <p>Sem amostra suficiente para montar o mapa de calor.</p>

  const byKey = new Map(cells.map((cell) => [`${cell.localWeekday}:${cell.localHour}`, cell]))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr>
            <th>Dia</th>
            {Array.from({ length: 24 }, (_, hour) => <th key={hour}>{String(hour).padStart(2, '0')}h</th>)}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((weekday) => (
            <tr key={weekday}>
              <th>{weekday}</th>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = byKey.get(`${weekday}:${hour}`)
                const label = cell
                  ? `${weekday} ${String(hour).padStart(2, '0')}:00: ${cell.sampleSize} posts, retenção ${format(cell.retentionMedian)}, alcance ${format(cell.reachMedian)}, interação ${format(cell.engagementMedian)}`
                  : `${weekday} ${String(hour).padStart(2, '0')}:00: sem dados`
                return (
                  <td
                    key={hour}
                    title={label}
                    aria-label={label}
                    style={{
                      border: '1px solid #eee',
                      padding: 6,
                      textAlign: 'center',
                      opacity: cell ? 0.35 + 0.65 * (cell.strength ?? 0.25) : 0.2,
                      fontWeight: cell && (cell.strength ?? 0) >= 0.75 ? 700 : 400,
                    }}
                  >
                    {cell ? cell.sampleSize : '·'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Cada célula mostra a quantidade de posts. Maior intensidade indica uma combinação mais forte das métricas disponíveis; o texto acessível mantém as medianas visíveis sem depender de cor.
      </p>
    </div>
  )
}

function format(value: number | null): string {
  return value === null ? 'indisponível' : new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)
}
