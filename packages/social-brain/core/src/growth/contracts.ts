// Lumenva Autonomous Growth OS - Wave 1 Contracts
// Common contracts defining the Growth domain for Maestri and Agents.

export type CampaignStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'completed' | 'archived';
export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  objective: string;
  status: CampaignStatus;
  budget?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export type ContentFormat = 'post' | 'carousel' | 'reel' | 'story' | 'blog' | 'email';
export interface Content {
  id: string;
  campaignId?: string;
  tenantId: string;
  format: ContentFormat;
  topic: string;
  body: string;
  createdAt: string;
}

export type AssetType = 'image' | 'video' | 'audio' | 'document';
export interface Asset {
  id: string;
  tenantId: string;
  type: AssetType;
  url: string;
  externalId?: string; // e.g., Meta media ID
  createdAt: string;
}

export type PublicationStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
export interface Publication {
  id: string;
  tenantId: string;
  contentId: string;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'blog';
  status: PublicationStatus;
  scheduledFor?: string;
  publishedAt?: string;
  externalId?: string; // ID returned by the platform
  evidenceId?: string;
}

export interface Metric {
  id: string;
  tenantId: string;
  entityId: string; // ID of Campaign, Content, or Publication
  entityType: 'campaign' | 'content' | 'publication';
  name: 'reach' | 'impressions' | 'engagement' | 'watch_time' | 'clicks' | 'sessions' | 'leads' | 'qualified_leads' | 'conversions' | 'revenue';
  value: number;
  recordedAt: string;
}

export interface Experiment {
  id: string;
  tenantId: string;
  name: string;
  hypothesis: string;
  variants: string[]; // IDs of Content or Campaigns being tested
  winnerVariantId?: string;
  status: 'running' | 'concluded';
}

export type ApprovalLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export interface Approval {
  id: string;
  tenantId: string;
  entityId: string; // What is being approved
  level: ApprovalLevel;
  status: ApprovalStatus;
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string; // User ID or Agent ID
  reason?: string;
}

export interface Evidence {
  id: string;
  jobId: string;
  type: 'api_response' | 'screenshot' | 'analytics_snapshot' | 'test_result';
  provider: string;
  externalId?: string;
  data: Record<string, unknown>; // e.g., the raw JSON from Meta
  timestamp: string;
}

export type GrowthJobState = 'QUEUED' | 'RUNNING' | 'WAITING' | 'BLOCKED' | 'APPROVAL_REQUIRED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export interface GrowthJob {
  id: string;
  tenantId: string;
  agent: string; // Which agent is responsible
  campaignId?: string;
  input: Record<string, unknown>;
  state: GrowthJobState;
  toolsUsed: string[];
  costEstimate?: number;
  evidenceIds: string[];
  outputs: Record<string, unknown>;
  errors: string[];
  retries: number;
  timestamps: {
    queuedAt: string;
    startedAt?: string;
    completedAt?: string;
  };
}
