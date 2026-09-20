import { describe, expect, it } from 'vitest';
import { canPublish } from './policy';
import { snapshotHash, type ReviewSnapshot } from './review-snapshot';

const original: ReviewSnapshot = {
  contentId: 'content-1',
  script: 'Bonjour',
  mediaAssetIds: ['asset-1'],
  variants: [
    { platform: 'instagram', caption: 'IG', title: null, hashtags: ['#ig'] },
    { platform: 'facebook', caption: 'FB', title: null, hashtags: ['#fb'] },
    { platform: 'tiktok', caption: 'TT', title: null, hashtags: ['#tt'] },
    { platform: 'youtube', caption: 'YT', title: 'Short', hashtags: ['#yt'] },
  ],
  targetAccountIds: ['ig-1', 'fb-1', 'tt-1', 'yt-1'],
  scheduledFor: '2026-08-18T18:00:00+01:00',
  publishMode: 'schedule',
};

describe('approval policy', () => {
  it('rejects publish before explicit approval', () => {
    expect(
      canPublish({
        status: 'PENDING_APPROVAL',
        currentSnapshot: original,
        approvedSnapshotHash: null,
      }),
    ).toBe(false);
  });

  it('accepts publish only when approval matches the exact current snapshot', () => {
    expect(
      canPublish({
        status: 'APPROVED',
        currentSnapshot: original,
        approvedSnapshotHash: snapshotHash(original),
      }),
    ).toBe(true);
  });

  it('invalidates approval when caption changes', () => {
    const changed: ReviewSnapshot = {
      ...original,
      variants: original.variants.map((variant) =>
        variant.platform === 'instagram' ? { ...variant, caption: 'changed' } : variant,
      ),
    };

    expect(snapshotHash(changed)).not.toBe(snapshotHash(original));
  });

  it('invalidates approval when publish mode changes', () => {
    const changed: ReviewSnapshot = { ...original, publishMode: 'now', scheduledFor: null };
    expect(snapshotHash(changed)).not.toBe(snapshotHash(original));
  });
});
