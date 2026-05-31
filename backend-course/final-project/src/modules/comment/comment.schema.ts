import { z } from 'zod';

export const createCommentSchema = z.object({
  params: z.object({ postId: z.string().min(1) }),
  body: z.object({
    content: z.string().min(1, '评论内容不能为空').max(2000, '评论最多 2000 个字符'),
    parentId: z.string().optional(), // 回复的评论 ID
  }),
});

export const updateCommentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    content: z.string().min(1).max(2000),
  }),
});

export const commentIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const commentListSchema = z.object({
  params: z.object({ postId: z.string().min(1) }),
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('20'),
  }),
});
