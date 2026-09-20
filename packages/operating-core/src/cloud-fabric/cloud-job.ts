export enum CloudJobState {
  QUEUED = 'QUEUED',
  PREPARING = 'PREPARING',
  WORKING = 'WORKING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum CloudProvider {
  OPENAI_CLOUD = 'OPENAI_CLOUD',
  GOOGLE_CLOUD = 'GOOGLE_CLOUD',
  LOCAL_LINUX = 'LOCAL_LINUX',
  LOCAL_WINDOWS = 'LOCAL_WINDOWS'
}

export interface CloudJob {
  job_id: string;
  task_id: string;
  provider: CloudProvider;
  executor: string;
  repo: string;
  branch: string;
  base_sha: string;
  state: CloudJobState;
  created_at: Date;
  updated_at: Date;
  payload?: any;
}
