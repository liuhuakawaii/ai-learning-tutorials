import { Router } from 'express';
import { categoryController } from './category.controller';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { createCategorySchema, updateCategorySchema, categoryIdSchema } from './category.schema';

const router = Router();

router.get('/', categoryController.list);
router.post('/', authMiddleware, requireRole('ADMIN'), validate(createCategorySchema), categoryController.create);
router.put('/:id', authMiddleware, requireRole('ADMIN'), validate(updateCategorySchema), categoryController.update);
router.delete('/:id', authMiddleware, requireRole('ADMIN'), validate(categoryIdSchema), categoryController.delete);

export default router;
