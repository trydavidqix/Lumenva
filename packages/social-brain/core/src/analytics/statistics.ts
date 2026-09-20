import type { NormalizedMetrics } from './types'

export type NumericSummary = {
  sampleSize: number
  mean: number | null
  median: number | null
}

export function summarizeNumbers(values: Array<number | null | undefined>): NumericSummary {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (numbers.length === 0) return { sampleSize: 0, mean: null, median: null }

  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? null)

  return {
    sampleSize: numbers.length,
    mean: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
    median,
  }
}

export function percentDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function engagementActions(metrics: NormalizedMetrics): number | null {
  const values = [metrics.likes, metrics.comments, metrics.shares, metrics.saves]
  const available = values.filter((value): value is number => value !== null)
  if (available.length === 0) return null
  return available.reduce((sum, value) => sum + value, 0)
}
