import { z } from "zod";

export const contactRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  whatsapp: z.string().trim().min(8).max(32),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal(true),
  website: z.string().max(200).optional(),
});

export type ContactRequest = z.infer<typeof contactRequestSchema>;

export const parseContactRequest = (input: unknown) => contactRequestSchema.safeParse(input);
