import { CreativeJob, CreativeJobOptions } from './types';

export async function createCreativeJob(options: CreativeJobOptions): Promise<CreativeJob> {
  return {
    id: `job-${Date.now()}`,
    type: options.type,
    status: 'queued',
    prompt: options.prompt,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function processCreativeJob(job: CreativeJob): Promise<CreativeJob> {
  return {
    ...job,
    status: 'completed',
    resultUrl: `https://example.com/result/${job.id}`,
    updatedAt: new Date(),
  };
}
