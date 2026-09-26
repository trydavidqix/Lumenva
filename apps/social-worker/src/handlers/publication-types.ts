import type {
  ApprovalDecisionRecord,
  PublicationJobStatus,
  PublicationRef,
  SocialPublishingPort,
} from '@lumenva/core'

export type PublishWorkerContext = {
  id: string
  workspaceId: string
  contentItemId: string
  contentVariantId: string
  approvalId: string
  publishMode: 'schedule' | 'now'
  scheduledFor: string
  idempotencyKey: string
  status: PublicationJobStatus
  providerPublicationId: string | null
  providerAccountId: string
  caption: string
  title: string | null
}

export type ApprovedPublicationMedia = {
  id: string
  filename: string
  mimeType: string
  storageBucket: string
  storagePath: string
  providerMediaAssetId: string | null
  providerMediaProcessingStatus?: string | null
}

export type PublicationWorkerRepository = {
  loadContext(publishJobId: string): Promise<PublishWorkerContext | null>
  loadApprovedMedia(mediaAssetIds: string[]): Promise<ApprovedPublicationMedia[]>
  savePreparedMedia(
    mediaAssetId: string,
    providerMediaAssetId: string,
    processingStatus: string,
  ): Promise<void>
  markPublishing(publishJobId: string): Promise<void>
  markResult(publishJobId: string, result: PublicationRef): Promise<void>
  markRetrying(publishJobId: string, code: string, message: string): Promise<void>
  markFailed(publishJobId: string, code: string, message: string): Promise<void>
  markReconcileRequired(publishJobId: string, code: string, message: string): Promise<void>
}

export type PublicationMediaSource = {
  download(bucket: string, path: string): Promise<Uint8Array>
}

export type PublicationProviderMediaRef = {
  providerMediaAssetId: string
  processingStatus: string
}

export type PublicationProvider = Pick<
  SocialPublishingPort,
  'schedulePost' | 'publishNow' | 'getPublicationStatus'
> & {
  uploadMedia(input: {
    filename: string
    mimeType: string
    bytes: Uint8Array
    idempotencyKey: string
  }): Promise<PublicationProviderMediaRef>
  getMediaStatus(providerMediaAssetId: string): Promise<PublicationProviderMediaRef>
}

export type CurrentApprovalGuard = (
  contentItemId: string,
) => Promise<Pick<ApprovalDecisionRecord, 'id' | 'snapshot'>>

export type PublicationFinalizedHook = (input: {
  workspaceId: string
  contentVariantId: string
  publishJobId: string
}) => Promise<void>

export class PublicationWorkerError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, retryable: boolean) {
    super(message)
    this.name = 'PublicationWorkerError'
    this.code = code
    this.retryable = retryable
  }
}
