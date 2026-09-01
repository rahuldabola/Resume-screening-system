import { z } from 'zod';

export const createJobSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().trim().min(20, 'Description must be at least 20 characters'),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
