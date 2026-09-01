import { z } from 'zod';

export const candidateMetaSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email().optional().or(z.literal('')),
});

export type CandidateMetaInput = z.infer<typeof candidateMetaSchema>;
