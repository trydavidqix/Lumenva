import Link from 'next/link'

import type { AnalyticsDashboardViewModel } from '../../../lib/analytics/get-analytics-dashboard'
import { BestTimeCard } from './components/best-time-card'
import { Heatmap } from './components/heatmap'
import { KpiCard } from './components/kpi-card'

export function AnalyticsView({ model }: { model: AnalyticsDashboardViewModel }) {
  const highlights = Object.values(model.hourlyHighlights).filter((item) => item !== null)
  const maxHourlyViews = Math.max(1, ...model.hourly24h.map((bucket) => bucket.metrics.viewsDelta ?? 0))

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 1180, margin: '40px auto', padding: 24 }}>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>Analytics V1.1</p>
      <h1>Desempenho e melhores horários</h1>
      <p>
        Período analisado em <strong>{model.timeZone}</strong>. Hipóteses são apresentadas separadamente dos fatos.
      </p>

      <nav aria-label="Período de analytics" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '24px 0 12px' }}>
        {model.periodOptions.map((period) => (
          <Link
            key={period}
            href={`/analytics?window=${period}&platform=${model.platform}`}
            aria-current={period === model.window ? 'page' : undefined}
            style={{ border: '1px solid #bbb', borderRadius: 999, padding: '8px 12px', textDecoration: 'none', fontWeight: period === model.window ? 700 : 400 }}
          >
            {period}
          </Link>
        ))}
      </nav>

      <nav aria-label="Rede social" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {model.platformOptions.map((platform) => (
          <Link
            key={platform}
            href={`/analytics?window=${model.window}&platform=${platform}`}
            aria-current={platform === model.platform ? 'page' : undefined}
            style={{ border: '1px solid #bbb', borderRadius: 999, padding: '8px 12px', textDecoration: 'none', fontWeight: platform === model.platform ? 700 : 400, textTransform: 'capitalize' }}
          >
            {platform === 'all' ? 'Geral' : platform}
          </Link>
        ))}
      </nav>

      <section aria-label="Resumo executivo" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {model.kpis.map(({ key: kpiKey, ...kpi }) => <KpiCard key={kpiKey} {...kpi} />)}
      </section>

      {model.platform === 'all' && model.platforms.length > 0 ? (
        <section style={{ marginTop: 36 }}>
          <h2>Resumo por rede</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            {model.platforms.map((platform) => (
              <article key={platform.platform} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
                <strong style={{ textTransform: 'capitalize' }}>{platform.platform}</strong>
                <p>Views médias: {formatMetric(platform.metrics.views.mean)}</p>
                <p>Retenção média: {formatPercent(platform.metrics.retentionRate.mean)}</p>
                <p>Salvamentos médios: {formatMetric(platform.metrics.saves.mean)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: 36 }}>
        <h2>Melhores horários</h2>
        <p>Recomendações exigem amostra mínima e mostram confiança e evidências para {model.platform === 'all' ? 'todas as redes' : model.platform}.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          {model.recommendations.map((item) => <BestTimeCard key={item.objective} item={item} />)}
        </div>
      </section>

      <section style={{ marginTop: 36 }}>
        <h2>Mapa de calor por dia e hora</h2>
        <Heatmap cells={model.heatmap} />
      </section>

      {model.window === '24h' ? (
        <>
          <section style={{ marginTop: 36 }}>
            <h2>Picos e quedas nas últimas 24 horas</h2>
            {highlights.length === 0 ? <p>Sem dados comparáveis suficientes.</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {highlights.map((item) => item ? (
                  <article key={item.label} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
                    <strong>{item.label}</strong>
                    <p>{item.localWeekday} · {String(item.localHour).padStart(2, '0')}:00</p>
                    <p>{item.metric === 'retention' ? formatPercent(item.value) : formatMetric(item.value)}</p>
                    {item.evidenceSnapshotIds.length > 0 ? (
                      <details>
                        <summary>Ver evidências</summary>
                        <code style={{ fontSize: 12 }}>{item.evidenceSnapshotIds.join(', ')}</code>
                      </details>
                    ) : null}
                  </article>
                ) : null)}
              </div>
            )}
          </section>

          <section style={{ marginTop: 36 }}>
            <h2>Tendência de views por hora</h2>
            <p>Representação proporcional das mudanças comprováveis de views em cada hora.</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {model.hourly24h.map((bucket) => {
                const value = bucket.metrics.viewsDelta ?? 0
                const width = `${Math.max(value > 0 ? 3 : 0, (value / maxHourlyViews) * 100)}%`
                return (
                  <div key={bucket.index} aria-label={`${bucket.localWeekday} ${String(bucket.localHour).padStart(2, '0')}:00: ${formatMetric(bucket.metrics.viewsDelta)} views`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                      <span>{bucket.localWeekday} {String(bucket.localHour).padStart(2, '0')}:00</span>
                      <span>{formatMetric(bucket.metrics.viewsDelta)}</span>
                    </div>
                    <div style={{ height: 8, background: '#eee', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width, height: '100%', background: 'currentColor' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section style={{ marginTop: 36 }}>
            <h2>Últimas 24 horas, hora por hora</h2>
            <p>
              Views, interações e salvamentos mostram apenas mudanças comprováveis entre snapshots consecutivos.
              Retenção é a mediana observada nos posts capturados naquela hora; dados sem comparação ficam como indisponíveis.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                <thead>
                  <tr><th>Hora local</th><th>+ Views</th><th>+ Interações</th><th>+ Salvamentos</th><th>Retenção</th><th>Posts observados</th><th>Comparáveis</th><th>Evidências</th></tr>
                </thead>
                <tbody>
                  {model.hourly24h.map((bucket) => (
                    <tr key={bucket.index}>
                      <td>{bucket.localWeekday} {String(bucket.localHour).padStart(2, '0')}:00</td>
                      <td>{formatMetric(bucket.metrics.viewsDelta)}</td>
                      <td>{formatMetric(bucket.metrics.interactionsDelta)}</td>
                      <td>{formatMetric(bucket.metrics.savesDelta)}</td>
                      <td>{formatPercent(bucket.metrics.retentionMedian)}</td>
                      <td>{bucket.metrics.observedPostCount}</td>
                      <td>{bucket.metrics.comparablePostCount}</td>
                      <td>
                        {bucket.evidenceSnapshotIds.length > 0 ? (
                          <details><summary>{bucket.evidenceSnapshotIds.length}</summary><code style={{ fontSize: 12 }}>{bucket.evidenceSnapshotIds.join(', ')}</code></details>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <section style={{ marginTop: 36 }}>
        <h2>Conteúdos com melhor desempenho</h2>
        {model.topContent.length === 0 ? <p>Sem conteúdo suficiente neste período.</p> : (
          <ol>{model.topContent.map((post) => <li key={post.snapshotId} style={{ marginBottom: 12 }}><strong>{post.platform}</strong> · {post.views ?? 'views indisponíveis'} views · {post.engagementActions ?? 'interações indisponíveis'} interações · <code>{post.contentVariantId}</code></li>)}</ol>
        )}
      </section>

      {model.anomalies.length > 0 ? (
        <section style={{ marginTop: 36 }}>
          <h2>Anomalias observadas</h2>
          <p>Estes pontos foram marcados como outliers e não devem, sozinhos, definir o melhor horário.</p>
          <ul>{model.anomalies.map((item) => <li key={item.snapshotId}><code>{item.snapshotId}</code> · {item.reasons.join(', ')}</li>)}</ul>
        </section>
      ) : null}

      {model.availabilityNotes.length > 0 ? (
        <section style={{ marginTop: 36 }}>
          <h2>Disponibilidade de dados</h2>
          <ul>{model.availabilityNotes.map((note) => <li key={note}>{note}</li>)}</ul>
        </section>
      ) : null}
    </main>
  )
}

function formatMetric(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)}%`
}
