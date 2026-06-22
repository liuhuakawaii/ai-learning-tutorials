/**
 * API 请求测试数据
 */

export const apiRequestFixtures = {
  /** 有效的创建请求 */
  validCreateRequest: {
    method: 'POST',
    url: '/api/todos',
    body: { title: '通过 API 创建的 Todo' },
    headers: { 'Content-Type': 'application/json' },
  },

  /** 无效的创建请求（空标题） */
  invalidCreateRequest: {
    method: 'POST',
    url: '/api/todos',
    body: { title: '' },
    headers: { 'Content-Type': 'application/json' },
  },

  /** 更新请求 */
  updateRequest: {
    method: 'PATCH',
    url: '/api/todos/todo-1',
    body: { completed: true },
    headers: { 'Content-Type': 'application/json' },
  },
};

/** API 响应状态码常量 */
export const httpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;
