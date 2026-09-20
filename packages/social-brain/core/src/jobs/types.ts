export type BackgroundJobState = 'queued' | 'running' | 'succeeded' | 'failed';

export type BackgroundJob = {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  state: BackgroundJobState;
  attemptCount: number;
  maxAttempts: number;
  runAfter: string;
  lockedBy: string | null;
  lockedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};
