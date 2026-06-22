import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, store } from '@/api/server.js';

describe('API 集成测试', () => {
  beforeEach(() => {
    store.clear();
  });

  describe('GET /api/health', () => {
    it('返回健康状态', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/todos', () => {
    it('创建有效的 Todo', async () => {
      const res = await request(app)
        .post('/api/todos')
        .send({ title: '集成测试任务' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('集成测试任务');
      expect(res.body.data.completed).toBe(false);
      expect(res.body.data.id).toBeDefined();
    });

    it('空标题返回 400', async () => {
      const res = await request(app)
        .post('/api/todos')
        .send({ title: '' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('缺少 title 字段返回 400', async () => {
      const res = await request(app)
        .post('/api/todos')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/todos', () => {
    it('空列表返回空数组', async () => {
      const res = await request(app).get('/api/todos');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('返回已创建的 Todo', async () => {
      await request(app)
        .post('/api/todos')
        .send({ title: '任务1' })
        .set('Content-Type', 'application/json');

      await request(app)
        .post('/api/todos')
        .send({ title: '任务2' })
        .set('Content-Type', 'application/json');

      const res = await request(app).get('/api/todos');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/todos/:id', () => {
    it('返回存在的 Todo', async () => {
      const createRes = await request(app)
        .post('/api/todos')
        .send({ title: '查询任务' })
        .set('Content-Type', 'application/json');

      const todoId = createRes.body.data.id;
      const res = await request(app).get(`/api/todos/${todoId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('查询任务');
    });

    it('不存在的 ID 返回 404', async () => {
      const res = await request(app).get('/api/todos/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/todos/:id', () => {
    it('更新标题', async () => {
      const createRes = await request(app)
        .post('/api/todos')
        .send({ title: '原标题' })
        .set('Content-Type', 'application/json');

      const todoId = createRes.body.data.id;
      const res = await request(app)
        .patch(`/api/todos/${todoId}`)
        .send({ title: '新标题' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('新标题');
    });

    it('切换完成状态', async () => {
      const createRes = await request(app)
        .post('/api/todos')
        .send({ title: '任务' })
        .set('Content-Type', 'application/json');

      const todoId = createRes.body.data.id;
      const res = await request(app)
        .patch(`/api/todos/${todoId}`)
        .send({ completed: true })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.data.completed).toBe(true);
    });

    it('不存在的 ID 返回 404', async () => {
      const res = await request(app)
        .patch('/api/todos/nonexistent')
        .send({ title: '新标题' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('删除存在的 Todo', async () => {
      const createRes = await request(app)
        .post('/api/todos')
        .send({ title: '待删除' })
        .set('Content-Type', 'application/json');

      const todoId = createRes.body.data.id;
      const res = await request(app).delete(`/api/todos/${todoId}`);
      expect(res.status).toBe(204);

      // 验证已删除
      const getRes = await request(app).get(`/api/todos/${todoId}`);
      expect(getRes.status).toBe(404);
    });

    it('不存在的 ID 返回 404', async () => {
      const res = await request(app).delete('/api/todos/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/todos/:id/toggle', () => {
    it('切换完成状态', async () => {
      const createRes = await request(app)
        .post('/api/todos')
        .send({ title: '切换任务' })
        .set('Content-Type', 'application/json');

      const todoId = createRes.body.data.id;
      const res = await request(app).post(`/api/todos/${todoId}/toggle`);
      expect(res.status).toBe(200);
      expect(res.body.data.completed).toBe(true);
    });
  });

  describe('GET /api/todos/stats', () => {
    it('返回统计信息', async () => {
      await request(app).post('/api/todos').send({ title: '任务1' }).set('Content-Type', 'application/json');
      const res2 = await request(app).post('/api/todos').send({ title: '任务2' }).set('Content-Type', 'application/json');

      await request(app).patch(`/api/todos/${res2.body.data.id}`).send({ completed: true }).set('Content-Type', 'application/json');

      const res = await request(app).get('/api/todos/stats');
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.completed).toBe(1);
      expect(res.body.data.pending).toBe(1);
    });
  });

  describe('POST /api/todos/clear-completed', () => {
    it('清除已完成的 Todo', async () => {
      const res1 = await request(app).post('/api/todos').send({ title: '已完成' }).set('Content-Type', 'application/json');
      await request(app).post('/api/todos').send({ title: '未完成' }).set('Content-Type', 'application/json');
      await request(app).patch(`/api/todos/${res1.body.data.id}`).send({ completed: true }).set('Content-Type', 'application/json');

      const res = await request(app).post('/api/todos/clear-completed');
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(1);

      const listRes = await request(app).get('/api/todos');
      expect(listRes.body.data).toHaveLength(1);
    });
  });
});
