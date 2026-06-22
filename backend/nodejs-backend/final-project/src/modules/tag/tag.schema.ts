import { z } from 'zod';

export const createTagSchema = z.object({
  body: z.object({
    name: z.string().min(1, '标签名不能为空').max(30, '标签名最多 30 个字符'),
  }),
});

export const tagIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
