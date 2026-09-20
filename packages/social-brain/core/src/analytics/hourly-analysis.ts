import type { AnalyticsEvidenceSnapshot } from './context-service'
import { summarizeNumbers } from './statistics'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export type LocalWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type HourlyObservedMetrics = {
  viewsDelta: number | null
  interactionsDelta: number | null
  savesDelta: number | null
  retentionMedian: number | null
  comparablePostCount: number
  observedPostCount: number
}

export type HourlyAnalyticsBucket = {
  index: number
  startAt: string
  endAt: string
  localWeekday: LocalWeekday
  localHour: number
  evidenceSnapshotIds: string[]
  baselineEvidenceSnapshotIds: string[]
  metrics: HourlyObservedMetrics
  baselineMetrics: HourlyObservedMetrics
}

export type PublishedPostTimeInput = {
  id: string
  publishedAt: string
}

export type LocalPostSlot = {
  localWeekday: LocalWeekday
  localHour: number
  postIds: string[]
}

export function buildRolling24hBuckets(
  evidence: AnalyticsEvidenceSnapshot[],
  asOf: string,
  timeZone: string,
): HourlyAnalyticsBucket[] {
  const asOfMs = parseTimestamp(asOf)
  const currentStartMs = asOfMs - DAY_MS

  return Array.from({ length: 24 }, (_, index) => {
    const startMs = currentStartMs + index * HOUR_MS
    const endMs = startMs + HOUR_MS
    const baselineStartMs = startMs - DAY_MS
    const baselineEndMs = endMs - DAY_MS
    const local = localSlot(startMs, timeZone)

    return {
      index,
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(endMs).toISOString(),
      localWeekday: local.localWeekday,
      localHour: local.localHour,
      evidenceSnapshotIds: evidence
        .filter((row) => inBucket(row.capturedAt, startMs, endMs))
        .map((row) => row.id),
      baselineEvidenceSnapshotIds: evidence
        .filter((row) => inBucket(row.capturedAt, baselineStartMs, baselineEndMs))
        .map((row) => row.id),
      metrics: observedMetricsForBucket(evidence, startMs, endMs),
      baselineMetrics: observedMetricsForBucket(evidence, baselineStartMs, baselineEndMs),
    }
  })
}

export function groupPostsByLocalSlot<T extends PublishedPostTimeInput>(
  posts: T[],
  timeZone: string,
): LocalPostSlot[] {
  const groups = new Map<string, LocalPostSlot>()

  for (const post of posts) {
    const timestamp = parseTimestamp(post.publishedAt)
    const slot = localSlot(timestamp, timeZone)
    const key = `${slot.localWeekday}:${slot.localHour}`
    const existing = groups.get(key)
    if (existing) {
      existing.postIds.push(post.id)
    } else {
      groups.set(key, {
        localWeekday: slot.localWeekday,
        localHour: slot.localHour,
        postIds: [post.id],
      })
    }
  }

  return [...groups.values()].sort((a, b) => {
    const weekdayDelta = weekdayIndex(a.localWeekday) - weekdayIndex(b.localWeekday)
    return weekdayDelta !== 0 ? weekdayDelta : a.localHour - b.localHour
  })
}

function observedMetricsForBucket(
  evidence: AnalyticsEvidenceSnapshot[],
  startMs: number,
  endMs: number,
): HourlyObservedMetrics {
  const postSnapshots = evidence.filter((row) => row.contentVariantId !== null && row.captureWindow === null)
  const byPost = new Map<string, AnalyticsEvidenceSnapshot[]>()

  for (const row of postSnapshots) {
    const key = row.contentVariantId as string
    const rows = byPost.get(key) ?? []
    rows.push(row)
    byPost.set(key, rows)
  }

  const viewsDeltas: number[] = []
  const interactionDeltas: number[] = []
  const savesDeltas: number[] = []
  const observedRetention: number[] = []
  let comparablePostCount = 0
  let observedPostCount = 0

  for (const rows of byPost.values()) {
    const ordered = [...rows].sort((a, b) => parseTimestamp(a.capturedAt) - parseTimestamp(b.capturedAt))
    const inside = ordered.filter((row) => inBucket(row.capturedAt, startMs, endMs))
    if (inside.length === 0) continue

    observedPostCount += 1
    const current = inside[inside.length - 1]!
    if (current.metrics.retentionRate !== null) observedRetention.push(current.metrics.retentionRate)

    const previous = [...ordered]
      .reverse()
      .find((row) => parseTimestamp(row.capturedAt) <= startMs)
    if (!previous) continue

    comparablePostCount += 1
    pushCounterDelta(viewsDeltas, previous.metrics.views, current.metrics.views)
    pushCounterDelta(savesDeltas, previous.metrics.saves, current.metrics.saves)

    const previousInteractions = sumAvailable([
      previous.metrics.likes,
      previous.metrics.comments,
      previous.metrics.shares,
    ])
    const currentInteractions = sumAvailable([
      current.metrics.likes,
      current.metrics.comments,
      current.metrics.shares,
    ])
    pushCounterDelta(interactionDeltas, previousInteractions, currentInteractions)
  }

  return {
    viewsDelta: sumOrNull(viewsDeltas),
    interactionsDelta: sumOrNull(interactionDeltas),
    savesDelta: sumOrNull(savesDeltas),
    retentionMedian: summarizeNumbers(observedRetention).median,
    comparablePostCount,
    observedPostCount,
  }
}

function pushCounterDelta(target: number[], previous: number | null, current: number | null): void {
  if (previous === null || current === null) return
  target.push(Math.max(0, current - previous))
}

function sumAvailable(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value !== null)
  return available.length === 0 ? null : available.reduce((sum, value) => sum + value, 0)
}

function sumOrNull(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0)
}

function localSlot(timestampMs: number, timeZone: string): {
  localWeekday: LocalWeekday
  localHour: number
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(new Date(timestampMs))
  const weekday = parts.find((part) => part.type === 'weekday')?.value.toLowerCase()
  const hourValue = parts.find((part) => part.type === 'hour')?.value
  const localHour = hourValue === undefined ? Number.NaN : Number.parseInt(hourValue, 10)

  if (!isLocalWeekday(weekday) || !Number.isInteger(localHour) || localHour < 0 || localHour > 23) {
    throw new Error('Unable to resolve local analytics time slot')
  }

  return { localWeekday: weekday, localHour }
}

function inBucket(value: string, exclusiveStartMs: number, inclusiveEndMs: number): boolean {
  const timestamp = parseTimestamp(value)
  return timestamp > exclusiveStartMs && timestamp <= inclusiveEndMs
}

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error('Invalid analytics timestamp')
  return timestamp
}

function isLocalWeekday(value: string | undefined): value is LocalWeekday {
  return value === 'monday'
    || value === 'tuesday'
    || value === 'wednesday'
    || value === 'thursday'
    || value === 'friday'
    || value === 'saturday'
    || value === 'sunday'
}

function weekdayIndex(value: LocalWeekday): number {
  return [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ].indexOf(value)
}
