import type { TimeSlotRecommendation } from '@lumenva/core'

import { assessReviewSchedule } from './review-schedule-assessment'

export function ReviewScheduleContext({
  scheduledFor,
  timeZone,
  bestOverall,
}: {
  scheduledFor: string | null
  timeZone: string
  bestOverall: TimeSlotRecommendation | null
}) {
  if (!scheduledFor) {
    return (
      <section>
        <h2>Contexto do horário</h2>
        <p>Publicação imediata: não existe horário agendado para comparar com o histórico.</p>
      </section>
    )
  }

  const assessment = assessReviewSchedule(scheduledFor, timeZone, bestOverall)

  return (
    <section>
      <h2>Contexto do horário</h2>
      <p>{assessment.message}</p>
      {bestOverall ? (
        <p style={{ fontSize: 13, opacity: 0.75 }}>
          Melhor padrão geral observado: {bestOverall.localWeekday} às {String(bestOverall.localHour).padStart(2, '0')}:00 ·
          {' '}{bestOverall.sampleSize} posts · confiança {bestOverall.confidence}.
        </p>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.75 }}>Ainda não existe amostra suficiente para recomendar outro horário.</p>
      )}
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        Esta comparação é somente informativa. O horário não é alterado automaticamente.
      </p>
    </section>
  )
}
