import { z } from 'zod'

export const VideoBriefSchema = z
  .object({
    format: z.literal('9:16'),
    durationTargetSeconds: z.number().int().positive(),
    visualDirection: z.string().trim().min(1),
    voiceDirection: z.string().trim().min(1).optional(),
  })
  .strict()

export const ContentPlanSchema = z
  .object({
    objective: z.string().trim().min(1),
    topic: z.string().trim().min(1),
    hook: z.string().trim().min(1),
    script: z.string().trim().min(1),
    videoBrief: VideoBriefSchema,
  })
  .strict()

export type VideoBrief = z.infer<typeof VideoBriefSchema>
export type ContentPlanInput = z.infer<typeof ContentPlanSchema>
