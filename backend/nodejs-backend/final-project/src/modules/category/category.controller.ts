import { Request, Response } from 'express';
import { categoryService } from './category.service';
import { sendSuccess } from '../../utils/response';

export class CategoryController {
  async list(_req: Request, res: Response) {
    const categories = await categoryService.list();
    sendSuccess(res, categories);
  }

  async create(req: Request, res: Response) {
    const { name, description } = req.body;
    const category = await categoryService.create(name, description);
    sendSuccess(res, category, '分类创建成功', 201);
  }

  async update(req: Request, res: Response) {
    const category = await categoryService.update(req.params.id, req.body);
    sendSuccess(res, category, '分类更新成功');
  }

  async delete(req: Request, res: Response) {
    await categoryService.delete(req.params.id);
    sendSuccess(res, null, '分类已删除');
  }
}

export const categoryController = new CategoryController();
