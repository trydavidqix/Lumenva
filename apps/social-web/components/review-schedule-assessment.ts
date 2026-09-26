import type { TimeSlotRecommendation } from '@lumenva/core'

export type ReviewScheduleAssessment = {
  scheduledLocalWeekday: string
  scheduledLocalHour: number
  alignedWithBestOverall: boolean | null
  message: string
}

export function assessReviewSchedule(
  scheduledFor: string,
  timeZone: string,
  bestOverall: TimeSlotRecommendation | null,
): ReviewScheduleAssessment {
  const scheduled = localSlot(scheduledFor, timeZone)
  if (!bestOverall) {
    return {
      ...scheduled,
      alignedWithBestOverall: null,
      message: `Agendado para ${scheduled.scheduledLocalWeekday} às ${String(scheduled.scheduledLocalHour).padStart(2, '0')}:00. Não há amostra histórica suficiente para comparar.`,
    }
  }

  const aligned = scheduled.scheduledLocalWeekday === bestOverall.localWeekday
    && scheduled.scheduledLocalHour === bestOverall.localHour

  return {
    ...scheduled,
    alignedWithBestOverall: aligned,
    message: aligned
      ? `O horário proposto está alinhado com o melhor padrão geral observado (${bestOverall.confidence} confiança).`
      : 'O horário proposto não coincide com o melhor padrão geral observado. Considere a evidência antes de aprovar, sem alterar o agendamento automaticamente.',
  }
}

function localSlot(value: string, timeZone: string): Pick<ReviewScheduleAssessment, 'scheduledLocalWeekday' | 'scheduledLocalHour'> {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid review schedule timestamp')

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(date)
  const weekday = parts.find((part) => part.type === 'weekday')?.value.toLowerCase()
  const hour = Number.parseInt(parts.find((part) => part.type === 'hour')?.value ?? '', 10)
  if (!weekday || !Number.isInteger(hour)) throw new Error('Unable to resolve review schedule timezone')

  return { scheduledLocalWeekday: weekday, scheduledLocalHour: hour }
}
