import { type Todo, type CreateTodoInput, type UpdateTodoInput, CreateTodoSchema, UpdateTodoSchema } from '../models/todo.js';
import { type TodoStore } from '../store/todo-store.js';
import { generateId, getCurrentTimestamp } from '../utils/date.js';

/**
 * Todo 业务服务层
 * 封装业务逻辑，协调 store 和外部依赖
 */
export class TodoService {
  constructor(private store: TodoStore) {}

  /** 获取所有 Todo 项 */
  getAll(): Todo[] {
    return this.store.getAll();
  }

  /** 获取单个 Todo 项 */
  getById(id: string): Todo | null {
    return this.store.getById(id) ?? null;
  }

  /** 创建新的 Todo 项 */
  create(input: CreateTodoInput): Todo {
    const validated = CreateTodoSchema.parse(input);
    return this.store.create(validated, generateId, getCurrentTimestamp);
  }

  /** 更新 Todo 项 */
  update(id: string, input: UpdateTodoInput): Todo | null {
    const validated = UpdateTodoSchema.parse(input);
    return this.store.update(id, validated, getCurrentTimestamp);
  }

  /** 删除 Todo 项 */
  delete(id: string): boolean {
    return this.store.delete(id);
  }

  /** 切换完成状态 */
  toggleComplete(id: string): Todo | null {
    const todo = this.store.getById(id);
    if (!todo) return null;
    return this.store.update(id, { completed: !todo.completed }, getCurrentTimestamp);
  }

  /** 批量删除已完成的 Todo */
  clearCompleted(): number {
    const all = this.store.getAll();
    const completed = all.filter(t => t.completed);
    completed.forEach(t => this.store.delete(t.id));
    return completed.length;
  }

  /** 按状态筛选 */
  getByStatus(completed: boolean): Todo[] {
    return this.store.getAll().filter(t => t.completed === completed);
  }

  /** 搜索 Todo（按标题关键词） */
  search(keyword: string): Todo[] {
    const lower = keyword.toLowerCase();
    return this.store.getAll().filter(t => t.title.toLowerCase().includes(lower));
  }

  /** 获取统计信息 */
  getStats(): { total: number; completed: number; pending: number } {
    const all = this.store.getAll();
    const completed = all.filter(t => t.completed).length;
    return {
      total: all.length,
      completed,
      pending: all.length - completed,
    };
  }
}
