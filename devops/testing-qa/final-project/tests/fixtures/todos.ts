import type { Todo } from '../../src/models/todo.js';

/**
 * Todo 测试数据工厂
 * 提供预定义的测试数据集，用于不同测试场景
 */

/** 基础 Todo 数据集 */
export const todoFixtures = {
  /** 默认 Todo 列表（3 项） */
  defaultTodos: [
    {
      id: 'todo-1',
      title: '学习 Vitest 单元测试',
      completed: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'todo-2',
      title: '编写集成测试',
      completed: true,
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-03T00:00:00.000Z',
    },
    {
      id: 'todo-3',
      title: '配置 Playwright E2E 测试',
      completed: false,
      createdAt: '2024-01-04T00:00:00.000Z',
      updatedAt: '2024-01-04T00:00:00.000Z',
    },
  ] as Todo[],

  /** 单个 Todo 项 */
  singleTodo: {
    id: 'todo-single',
    title: '单个测试 Todo',
    completed: false,
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
  } as Todo,

  /** 已完成的 Todo */
  completedTodo: {
    id: 'todo-completed',
    title: '已完成的任务',
    completed: true,
    createdAt: '2024-05-01T00:00:00.000Z',
    updatedAt: '2024-05-02T00:00:00.000Z',
  } as Todo,

  /** 边界情况：标题最长 */
  longTitleTodo: {
    id: 'todo-long',
    title: '这是一个非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的标题',
    completed: false,
    createdAt: '2024-07-01T00:00:00.000Z',
    updatedAt: '2024-07-01T00:00:00.000Z',
  } as Todo,
};

/** 创建 Todo 的输入数据集 */
export const createInputFixtures = {
  valid: { title: '新的测试任务' },
  emptyTitle: { title: '' },
  whitespaceTitle: { title: '   ' },
  longTitle: { title: 'a'.repeat(201) },
};

/** 更新 Todo 的输入数据集 */
export const updateInputFixtures = {
  titleOnly: { title: '更新后的标题' },
  completedOnly: { completed: true },
  both: { title: '同时更新标题', completed: true },
  empty: {},
};
