import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().min(1, '标题不能为空').max(200, '标题最多 200 个字符'),
    content: z.string().min(1, '内容不能为空'),
    excerpt: z.string().max(500).optional(),
    coverImage: z.string().url().optional(),
    categoryId: z.string().optional(),
    tags: z.array(z.string()).optional(), // 标签 ID 数组
  }),
});

export const updatePostSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
    excerpt: z.string().max(500).optional(),
    coverImage: z.string().url().optional(),
    categoryId: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const postListSchema = z.object({
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    categoryId: z.string().optional(),
    tagId: z.string().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    sortBy: z.enum(['createdAt', 'viewCount', 'title']).optional().default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const postIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const postSlugSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
});
