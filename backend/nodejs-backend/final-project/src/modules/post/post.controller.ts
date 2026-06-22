import { Request, Response } from 'express';
import { postService } from './post.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export class PostController {
  async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { posts, total } = await postService.list({
      page,
      limit,
      search: req.query.search as string,
      categoryId: req.query.categoryId as string,
      tagId: req.query.tagId as string,
      status: req.query.status as any,
      sortBy: req.query.sortBy as string,
      order: req.query.order as 'asc' | 'desc',
    });

    sendPaginated(res, posts, page, limit, total);
  }

  async getBySlug(req: Request, res: Response) {
    const post = await postService.getBySlug(req.params.slug);
    sendSuccess(res, post);
  }

  async create(req: Request, res: Response) {
    const post = await postService.create(req.user!.id, req.body);
    sendSuccess(res, post, '文章创建成功', 201);
  }

  async update(req: Request, res: Response) {
    const post = await postService.update(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    sendSuccess(res, post, '文章更新成功');
  }

  async publish(req: Request, res: Response) {
    const post = await postService.publish(
      req.params.id,
      req.user!.id,
      req.user!.role
    );
    sendSuccess(res, post, '文章已发布');
  }

  async delete(req: Request, res: Response) {
    await postService.delete(req.params.id, req.user!.id, req.user!.role);
    sendSuccess(res, null, '文章已删除');
  }
}

export const postController = new PostController();
