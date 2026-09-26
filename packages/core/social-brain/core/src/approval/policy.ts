import type { ContentStatus } from '../content/status';
import { snapshotHash, type ReviewSnapshot } from './review-snapshot';

export type PublishEligibility = {
  status: ContentStatus;
  currentSnapshot: ReviewSnapshot;
  approvedSnapshotHash: string | null;
};

export function canPublish(input: PublishEligibility): boolean {
  if (input.status !== 'APPROVED' || input.approvedSnapshotHash === null) return false;
  return snapshotHash(input.currentSnapshot) === input.approvedSnapshotHash;
}
