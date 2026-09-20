export type AdsDraft = {
  id: string;
  campaignName: string;
  creativeContent: string;
};

export type BudgetProposal = {
  amount: number;
  currency: string;
  dailyLimit?: number;
};

export type TargetingProposal = {
  audienceIds: string[];
  locations: string[];
};

export type AdCampaignProposal = {
  id: string;
  draft: AdsDraft;
  budget: BudgetProposal;
  targeting: TargetingProposal;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'active';
};

export type AdsPolicy = {
  autoApproveBudgetLimit: number;
  autoApprovalEnabled: boolean;
};

export class AdsManager {
  constructor(private policy: AdsPolicy) {}

  public proposeCampaign(
    draft: AdsDraft,
    budget: BudgetProposal,
    targeting: TargetingProposal
  ): AdCampaignProposal {
    return {
      id: `proposal_${Date.now()}`,
      draft,
      budget,
      targeting,
      status: 'pending_approval',
    };
  }

  public evaluateProposal(proposal: AdCampaignProposal): AdCampaignProposal {
    // Explicitly block budget usage automatically unless policy is explicitly set for auto-approval
    // and the budget is within the allowed limit.
    if (
      this.policy.autoApprovalEnabled &&
      proposal.budget.amount <= this.policy.autoApproveBudgetLimit
    ) {
      return { ...proposal, status: 'approved' };
    }

    return { ...proposal, status: 'pending_approval' };
  }

  public activateCampaign(proposal: AdCampaignProposal): AdCampaignProposal {
    if (proposal.status !== 'approved') {
      throw new Error('Cannot activate campaign: approval is required before budget usage.');
    }

    return { ...proposal, status: 'active' };
  }
}
