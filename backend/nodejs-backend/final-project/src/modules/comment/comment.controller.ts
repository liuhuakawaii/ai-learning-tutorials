import { Request, Response } from 'express';
import { commentService } from './comment.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export class CommentController {
  async listByPost(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { comments, total } = await commentService.listByPost(req.params.postId, page, limit);
    sendPaginated(res, comments, page, limit, total);
  }

  async create(req: Request, res: Response) {
    const { content, parentId } = req.body;
    const comment = await commentService.create(
      req.params.postId,
      req.user!.id,
      content,
      parentId
    );
    sendSuccess(res, comment, '评论成功', 201);
  }

  async update(req: Request, res: Response) {
    const comment = await commentService.update(req.params.id, req.user!.id, req.body.content);
    sendSuccess(res, comment, '评论更新成功');
  }

  async delete(req: Request, res: Response) {
    await commentService.delete(req.params.id, req.user!.id, req.user!.role);
    sendSuccess(res, null, '评论已删除');
  }
}

export const commentController = new CommentController();
