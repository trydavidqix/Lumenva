import { z } from 'zod'

export const TaskCreatedResponseSchema = z.object({
  status: z.number().int(),
  message: z.string().optional(),
  data: z.object({ task_id: z.string().min(1) }).passthrough(),
}).passthrough()

export const TaskStatusResponseSchema = z.object({
  status: z.number().int(),
  message: z.string().optional(),
  data: z.object({
    task_id: z.string().min(1),
    state: z.number().int(),
    progress: z.number().int().optional(),
    videos: z.array(z.string().min(1)).optional(),
    combined_videos: z.array(z.string().min(1)).optional(),
    failed_stage: z.string().optional(),
    error: z.string().optional(),
  }).passthrough(),
}).passthrough()

export type MoneyPrinterTaskStatus = z.infer<typeof TaskStatusResponseSchema>['data']
