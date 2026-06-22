import { http, HttpResponse } from 'msw';
import { todoFixtures } from '../fixtures/todos.js';

const API_BASE = '/api';

export const handlers = [
  // 获取所有 Todo
  http.get(`${API_BASE}/todos`, () => {
    return HttpResponse.json({ data: todoFixtures.defaultTodos });
  }),

  // 获取单个 Todo
  http.get(`${API_BASE}/todos/:id`, ({ params }) => {
    const todo = todoFixtures.defaultTodos.find(t => t.id === params.id);
    if (!todo) {
      return HttpResponse.json({ error: 'Todo 不存在' }, { status: 404 });
    }
    return HttpResponse.json({ data: todo });
  }),

  // 创建 Todo
  http.post(`${API_BASE}/todos`, async ({ request }) => {
    const body = (await request.json()) as { title: string };
    const newTodo = {
      id: 'new-todo-id',
      title: body.title,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ data: newTodo }, { status: 201 });
  }),

  // 更新 Todo
  http.patch(`${API_BASE}/todos/:id`, async ({ params, request }) => {
    const todo = todoFixtures.defaultTodos.find(t => t.id === params.id);
    if (!todo) {
      return HttpResponse.json({ error: 'Todo 不存在' }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const updated = { ...todo, ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json({ data: updated });
  }),

  // 删除 Todo
  http.delete(`${API_BASE}/todos/:id`, ({ params }) => {
    const exists = todoFixtures.defaultTodos.some(t => t.id === params.id);
    if (!exists) {
      return HttpResponse.json({ error: 'Todo 不存在' }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // 健康检查
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }),
];

// 用于测试错误场景的处理器
export const errorHandlers = [
  http.get(`${API_BASE}/todos`, () => {
    return HttpResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }),
  http.post(`${API_BASE}/todos`, () => {
    return HttpResponse.json({ error: '请求参数无效' }, { status: 400 });
  }),
];
