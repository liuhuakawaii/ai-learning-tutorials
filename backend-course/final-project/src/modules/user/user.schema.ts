import { z } from 'zod';

export const userListSchema = z.object({
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
  }),
});

export const userIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, '用户 ID 不能为空'),
  }),
});
