import { Router, type Router as ExpressRouter } from 'express';
import { postController } from './post.controller';
import { authMiddleware, optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createPostSchema, updatePostSchema, postListSchema, postSlugSchema, postIdSchema } from './post.schema';

const router: ExpressRouter = Router();

// 公开路由
router.get('/', validate(postListSchema), postController.list);
router.get('/:slug', validate(postSlugSchema), postController.getBySlug);

// 需要登录
router.post('/', authMiddleware, validate(createPostSchema), postController.create);
router.put('/:id', authMiddleware, validate(updatePostSchema), postController.update);
router.put('/:id/publish', authMiddleware, validate(postIdSchema), postController.publish);
router.delete('/:id', authMiddleware, validate(postIdSchema), postController.delete);

export default router;
