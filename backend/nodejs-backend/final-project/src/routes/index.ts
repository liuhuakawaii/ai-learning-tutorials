import { Router, type Router as ExpressRouter } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/user/user.routes';
import postRoutes from '../modules/post/post.routes';
import categoryRoutes from '../modules/category/category.routes';
import tagRoutes from '../modules/tag/tag.routes';
import commentRoutes from '../modules/comment/comment.routes';

const router: ExpressRouter = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
router.use('/categories', categoryRoutes);
router.use('/tags', tagRoutes);
router.use('/posts/:postId/comments', commentRoutes);

export default router;
