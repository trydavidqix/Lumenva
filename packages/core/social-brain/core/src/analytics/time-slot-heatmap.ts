import { groupPostsByLocalSlot, type LocalWeekday } from './hourly-analysis'
import { engagementActions, summarizeNumbers } from './statistics'
import type { TimeSlotPostEvidence } from './time-slot-ranking'

export type TimeSlotHeatmapCell = {
  localWeekday: LocalWeekday
  localHour: number
  sampleSize: number
  reachMedian: number | null
  retentionMedian: number | null
  engagementMedian: number | null
  strength: number | null
  evidenceSnapshotIds: string[]
}

export function buildTimeSlotHeatmap(
  posts: TimeSlotPostEvidence[],
  timeZone: string,
): TimeSlotHeatmapCell[] {
  const bySnapshotId = new Map(posts.map((post) => [post.snapshotId, post]))
  const groups = groupPostsByLocalSlot(
    posts.map((post) => ({ id: post.snapshotId, publishedAt: post.publishedAt })),
    timeZone,
  )

  const cells = groups.map((group) => {
    const slotPosts = group.postIds
      .map((id) => bySnapshotId.get(id))
      .filter((post): post is TimeSlotPostEvidence => post !== undefined)

    return {
      localWeekday: group.localWeekday,
      localHour: group.localHour,
      sampleSize: slotPosts.length,
      reachMedian: summarizeNumbers(slotPosts.map((post) => post.metrics.reach ?? post.metrics.views ?? post.metrics.impressions)).median,
      retentionMedian: summarizeNumbers(slotPosts.map((post) => post.metrics.retentionRate)).median,
      engagementMedian: summarizeNumbers(slotPosts.map((post) => engagementActions(post.metrics))).median,
      evidenceSnapshotIds: slotPosts.map((post) => post.snapshotId),
    }
  })

  const reachRange = valueRange(cells.map((cell) => cell.reachMedian))
  const retentionRange = valueRange(cells.map((cell) => cell.retentionMedian))
  const engagementRange = valueRange(cells.map((cell) => cell.engagementMedian))

  return cells.map((cell) => {
    const signals = [
      normalized(cell.reachMedian, reachRange),
      normalized(cell.retentionMedian, retentionRange),
      normalized(cell.engagementMedian, engagementRange),
    ].filter((value): value is number => value !== null)

    return {
      ...cell,
      strength: signals.length === 0 ? null : signals.reduce((sum, value) => sum + value, 0) / signals.length,
    }
  })
}

type Range = { min: number; max: number } | null

function valueRange(values: Array<number | null>): Range {
  const available = values.filter((value): value is number => value !== null)
  if (available.length === 0) return null
  return { min: Math.min(...available), max: Math.max(...available) }
}

function normalized(value: number | null, range: Range): number | null {
  if (value === null || !range) return null
  if (range.max === range.min) return 1
  return (value - range.min) / (range.max - range.min)
}
