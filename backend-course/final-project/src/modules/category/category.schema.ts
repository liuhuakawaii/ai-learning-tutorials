import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, '分类名不能为空').max(50, '分类名最多 50 个字符'),
    description: z.string().max(200).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(200).optional(),
  }),
});

export const categoryIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
