export type ScheduleProposal = {
  contentItemId: string
  proposedFor: string
  rationale: string
}

export type SchedulingState = {
  contentItemId: string
  hasCurrentApproval: boolean
}

export type SaveScheduleProposalInput = ScheduleProposal & {
  publishMode: 'schedule'
}

export type ApprovalInvalidationOptions = {
  invalidateApproval: boolean
}

export type ScheduleRepository = {
  getSchedulingState(contentItemId: string): Promise<SchedulingState | null>
  saveScheduleProposal(
    input: SaveScheduleProposalInput,
    options: ApprovalInvalidationOptions,
  ): Promise<void>
  clearScheduleProposal(
    contentItemId: string,
    options: ApprovalInvalidationOptions,
  ): Promise<void>
}
