import { describe, expect, it } from 'vitest'

import { deriveContentPublicationStatus } from './worker-repository'

describe('aggregate content publication status', () => {
  it('keeps a fully scheduled four-network set scheduled', () => {
    expect(deriveContentPublicationStatus(
      ['scheduled', 'scheduled', 'scheduled', 'scheduled'],
      'schedule',
    )).toBe('SCHEDULED')
  })

  it('moves to publishing when one network has published but others are still scheduled', () => {
    expect(deriveContentPublicationStatus(
      ['published', 'scheduled', 'scheduled', 'scheduled'],
      'schedule',
    )).toBe('PUBLISHING')
  })

  it('marks published only after all networks are published', () => {
    expect(deriveContentPublicationStatus(
      ['published', 'published', 'published', 'published'],
      'schedule',
    )).toBe('PUBLISHED')
  })

  it('keeps a reconciliation or retry visible without erasing successful network state', () => {
    expect(deriveContentPublicationStatus(
      ['published', 'scheduled', 'reconcile_required', 'scheduled'],
      'schedule',
    )).toBe('PUBLISHING')
    expect(deriveContentPublicationStatus(
      ['scheduled', 'retrying', 'scheduled', 'scheduled'],
      'schedule',
    )).toBe('RETRYING')
  })

  it('marks the aggregate failed when all work is settled and one network failed', () => {
    expect(deriveContentPublicationStatus(
      ['scheduled', 'scheduled', 'scheduled', 'failed'],
      'schedule',
    )).toBe('FAILED')
  })

  it('keeps immediate queued work in publishing state', () => {
    expect(deriveContentPublicationStatus(
      ['queued', 'queued', 'queued', 'queued'],
      'now',
    )).toBe('PUBLISHING')
  })
})
