import { http, HttpResponse } from 'msw';

/**
 * API 请求的 Mock 处理器集合
 * 用于模拟各种 API 响应场景
 */

const API_BASE = '/api';

// 正常响应处理器
export const successHandlers = {
  getTodos: http.get(`${API_BASE}/todos`, () => {
    return HttpResponse.json({
      data: [
        { id: '1', title: '学习测试', completed: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        { id: '2', title: '编写代码', completed: true, createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' },
      ],
    });
  }),

  createTodo: http.post(`${API_BASE}/todos`, async ({ request }) => {
    const body = (await request.json()) as { title: string };
    return HttpResponse.json({
      data: { id: '3', title: body.title, completed: false, createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-01-03T00:00:00Z' },
    }, { status: 201 });
  }),
};

// 错误响应处理器
export const errorHandlers = {
  serverError: http.get(`${API_BASE}/todos`, () => {
    return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }),

  networkError: http.get(`${API_BASE}/todos`, () => {
    return HttpResponse.error();
  }),

  timeout: http.get(`${API_BASE}/todos`, async () => {
    await new Promise(resolve => setTimeout(resolve, 10000));
    return HttpResponse.json({ data: [] });
  }),
};

// 空数据处理器
export const emptyHandlers = {
  emptyTodos: http.get(`${API_BASE}/todos`, () => {
    return HttpResponse.json({ data: [] });
  }),
};
