export type ContentStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'READY_FOR_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'FAILED'
  | 'RETRYING';

const transitions: Readonly<Record<ContentStatus, readonly ContentStatus[]>> = {
  DRAFT: ['GENERATING', 'READY_FOR_REVIEW'],
  GENERATING: ['READY_FOR_REVIEW', 'FAILED'],
  READY_FOR_REVIEW: ['PENDING_APPROVAL', 'GENERATING'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'READY_FOR_REVIEW'],
  APPROVED: ['SCHEDULED', 'PUBLISHING', 'READY_FOR_REVIEW'],
  SCHEDULED: ['PUBLISHING', 'FAILED'],
  PUBLISHING: ['PUBLISHED', 'FAILED', 'RETRYING'],
  PUBLISHED: [],
  REJECTED: ['DRAFT', 'READY_FOR_REVIEW'],
  FAILED: ['RETRYING', 'READY_FOR_REVIEW'],
  RETRYING: ['GENERATING', 'PUBLISHING', 'FAILED'],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return transitions[from].includes(to);
}
