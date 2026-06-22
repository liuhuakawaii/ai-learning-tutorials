import { Request, Response } from 'express';
import { tagService } from './tag.service';
import { sendSuccess } from '../../utils/response';

export class TagController {
  async list(_req: Request, res: Response) {
    const tags = await tagService.list();
    sendSuccess(res, tags);
  }

  async popular(req: Request, res: Response) {
    const limit = parseInt(req.query.limit as string) || 10;
    const tags = await tagService.popular(limit);
    sendSuccess(res, tags);
  }

  async create(req: Request, res: Response) {
    const tag = await tagService.create(req.body.name);
    sendSuccess(res, tag, '标签创建成功', 201);
  }

  async delete(req: Request, res: Response) {
    await tagService.delete(req.params.id);
    sendSuccess(res, null, '标签已删除');
  }
}

export const tagController = new TagController();
